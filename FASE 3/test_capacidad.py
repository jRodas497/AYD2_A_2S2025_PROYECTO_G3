"""Five load and five stress scenarios, real HTTP, measured resources and recovery."""
import json
import os
import statistics
import threading
import time
import unittest
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from qa_support import (admin_login, api, checkout, compose, customer, history,
                        pay, product, run_suite, sql, wait_for)

METRICS = []


def burst(name, calls, workers, allowed, max_ms):
    def invoke(call):
        start = time.perf_counter()
        try:
            value = call()
            status = 200
        except AssertionError as error:
            detail = error.args[0]
            if not isinstance(detail, tuple) or len(detail) < 2:
                raise
            status, value = detail[1], detail
        return status, (time.perf_counter() - start) * 1000, value
    samples, done = [], threading.Event()
    def sample():
        while not done.is_set():
            result = compose('stats', '--no-stream', '--format', 'json', capture_output=True)
            samples.append({'elapsed_s': round(time.perf_counter() - started, 3),
                            'containers': [json.loads(line) for line in result.stdout.splitlines() if line]})
            done.wait(2)
    started = time.perf_counter()
    monitor = threading.Thread(target=sample, daemon=True)
    monitor.start()
    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            rows = list(pool.map(invoke, calls))
        elapsed = time.perf_counter() - started
    finally:
        done.set()
        monitor.join(timeout=15)
    latencies = sorted(row[1] for row in rows)
    metrics = dict(name=name, requests=len(rows), concurrency=workers,
                   seconds=round(elapsed, 3), requests_per_second=round(len(rows)/elapsed, 2),
                   results=dict(Counter('accepted' if row[0] == 200 else 'HTTP ' + str(row[0]) for row in rows)),
                   p50_ms=round(statistics.median(latencies), 2),
                   p95_ms=round(latencies[int((len(rows)-1)*0.95)], 2),
                   p99_ms=round(latencies[int((len(rows)-1)*0.99)], 2),
                   max_ms=round(max(latencies), 2), threshold_ms=max_ms, resource_samples=samples)
    METRICS.append(metrics)
    print(json.dumps({k: v for k, v in metrics.items() if k != 'resource_samples'}), flush=True)
    assert samples and samples[0]['containers'], 'Resource measurements missing'
    assert all(row[0] in allowed for row in rows), metrics
    assert max(latencies) < max_ms, metrics
    return [row[2] for row in rows]


class CapacityBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin = admin_login()
        for p in ['payklik', 'sat', 'logiexpress', 'messaging', 'erp', 'pos']:
            api('/simulation/' + p, 'PUT', {'mode': 'NORMAL'}, cls.admin)
        cls.pid = product(cls.admin, 3000)
        cls.c = customer()
        history(cls.c['customerId'], cls.admin)
        cls.oid = checkout(cls.c, cls.pid)
        pay(cls.c, cls.oid)
        wait_for(f'/orders/{cls.oid}', lambda o: bool(o['trackingNumber']), cls.c['token'])
        cls.inspections = cls.inspect()

    @classmethod
    def inspect(cls):
        ids = compose('ps', '-q', capture_output=True).stdout.split()
        import subprocess
        return json.loads(subprocess.check_output(['docker', 'inspect', *ids], encoding='utf-8'))

    def tearDown(self):
        # Recovery must happen on every scenario, including those that intentionally reject traffic.
        started = time.monotonic()
        self.assertTrue(api('/products'))
        self.assertEqual(api(f'/orders/{self.oid}', token=self.c['token'])['orderId'], self.oid)
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(sql('select count(*) from inventory.stock where reserved<0 or on_hand<0 or reserved>on_hand'), '0')
        baseline = {r['Id']: r['RestartCount'] for r in self.inspections}
        for container in self.inspect():
            self.assertFalse(container['State']['OOMKilled'], container['Name'])
            self.assertTrue(container['State']['Running'], container['Name'])
            self.assertEqual(container['RestartCount'], baseline[container['Id']], container['Name'])

    def read(self, path, token=None):
        return lambda: api(path, token=token or self.admin)


class Load(CapacityBase):
    def test_L01_public_catalog_expected_load(self):
        burst('L01 catalog', [self.read('/products') for _ in range(256)], 16, {200}, 5000)

    def test_L02_order_status_sla(self):
        burst('L02 order status RC01', [self.read(f'/orders/{self.oid}') for _ in range(256)], 16, {200}, 5000)

    def test_L03_financial_audit_sla(self):
        burst('L03 audit RC02', [self.read(f'/reports/payments?orderId={self.oid}') for _ in range(256)], 8, {200}, 1000)

    def test_L04_credit_decisions_from_cached_erp(self):
        # This is a decision, not an unrelated GET or an empty data set.
        rows = burst('L04 credit decision', [self.read(f"/customers/{self.c['customerId']}/credit")
                     for _ in range(256)], 16, {200}, 2000)
        self.assertTrue(all(row['eligible'] for row in rows))

    def test_L05_concurrent_end_to_end_sales(self):
        clients = [customer() for _ in range(16)]
        def sale(c):
            oid = checkout(c, self.pid)
            self.assertEqual(pay(c, oid)['result'], 'APPROVED')
            return oid
        ids = burst('L05 full sales', [lambda c=c: sale(c) for c in clients], 16, {200}, 10000)
        for c, oid in zip(clients, ids):
            order = wait_for(f'/orders/{oid}', lambda o: bool(o['trackingNumber']), c['token'], 120)
            self.assertEqual(order['invoiceStatus'], 'ACCEPTED')
        self.assertEqual(len(set(ids)), 16)


class Stress(CapacityBase):
    def test_S01_staircase_to_eight_times_normal_read_load(self):
        for workers in [16, 32, 64, 128]:
            paths = ['/products', f'/orders/{self.oid}', f'/orders/{self.oid}/trace',
                     f'/reports/payments?orderId={self.oid}']
            burst(f'S01 mixed read ramp {workers}',
                  [self.read(paths[i % 4]) for i in range(1024)], workers, {200}, 15000)

    def test_S02_eighty_buyers_compete_for_ten_units(self):
        pid = product(self.admin, 10)
        clients = [customer() for _ in range(80)]
        for c in clients:
            api(f"/customers/{c['customerId']}/cart/items", 'POST',
                {'productId': pid, 'quantity': 1, 'channel': 'WEB'}, c['token'])
        calls = [lambda c=c: api('/orders/checkout', 'POST',
                 {'customerId': c['customerId'], 'deliveryAddress': 'Stock bajo estrés'}, c['token']) for c in clients]
        rows = burst('S02 overselling competition', calls, 80, {200, 409}, 15000)
        accepted = [r for r in rows if isinstance(r, dict)]
        self.assertEqual(len(accepted), 10)
        self.assertEqual(sql(f'select sum(quantity) from inventory.reservation where product_id={pid} and status_id=1'), '10')
        self.assertEqual(sql(f'select count(*) from orders.purchase_order o join orders.order_item i on i.order_id=o.id where i.product_id={pid}'), '10')
        self.assertEqual(sql(f'select count(*) from orders.order_item i where i.product_id={pid} and not exists '
                             f'(select 1 from inventory.reservation r where r.order_id=i.order_id and r.product_id={pid})'), '0')
        for o in accepted:
            api(f"/orders/{o['id']}/cancel", 'POST', {}, self.admin)

    def test_S03_thirty_two_payments_for_same_order_charge_once(self):
        c = customer()
        oid = checkout(c, self.pid)
        rows = burst('S03 duplicate payment contention', [lambda: pay(c, oid) for _ in range(32)],
                     32, {200, 409}, 15000)
        self.assertEqual(sum(isinstance(r, dict) and r['result'] == 'APPROVED' for r in rows), 1)
        wait_for(f'/orders/{oid}', lambda o: bool(o['trackingNumber']), c['token'])
        self.assertEqual(sql(f'select count(*) from payments.payment_attempt where order_id={oid} and result_id=1'), '1')
        self.assertEqual(sql(f'select count(*) from invoicing.invoice where order_id={oid}'), '1')
        records = compose('exec', '-T', 'payklik', 'python', '-c',
             "import urllib.request;print(urllib.request.urlopen('http://localhost:8090/records').read().decode())",
             capture_output=True).stdout
        self.assertEqual(sum(r['key'].startswith('charge-' + str(oid) + '-') for r in json.loads(records)), 1)

    def test_S04_thirty_two_checkouts_for_same_cart_are_atomic(self):
        c = customer()
        api(f"/customers/{c['customerId']}/cart/items", 'POST',
            {'productId': self.pid, 'quantity': 1, 'channel': 'WEB'}, c['token'])
        rows = burst('S04 duplicate checkout contention', [lambda: api('/orders/checkout', 'POST',
            {'customerId': c['customerId'], 'deliveryAddress': 'QA doble checkout'}, c['token']) for _ in range(32)],
            32, {200, 400, 409}, 15000)
        self.assertEqual(sum(isinstance(r, dict) for r in rows), 1)
        self.assertEqual(sql(f"select count(*) from orders.purchase_order where customer_id={c['customerId']}"), '1')
        self.assertEqual(sql(f"select sum(r.quantity) from inventory.reservation r join orders.purchase_order o "
                             f"on o.id=r.order_id where o.customer_id={c['customerId']}"), '1')

    def test_S05_slow_payklik_burst_preserves_credit_and_recovers_sales(self):
        clients = [customer() for _ in range(32)]
        ids = [checkout(c, self.pid) for c in clients]
        api('/simulation/payklik', 'PUT', {'mode': 'SLOW'}, self.admin)
        try:
            rows = burst('S05 slow provider burst', [lambda c=c, oid=oid: pay(c, oid)
                         for c, oid in zip(clients, ids)], 32, {200}, 15000)
            self.assertTrue(all(r['orderStatus'] in ['PAID', 'PAYMENT_IN_PROGRESS'] for r in rows))
            started = time.monotonic()
            credit_order = checkout(self.c, self.pid, method='CREDIT')
            self.assertEqual(pay(self.c, credit_order, 'CREDIT')['result'], 'APPROVED')
            self.assertLess(time.monotonic() - started, 2)
        finally:
            api('/simulation/payklik', 'PUT', {'mode': 'NORMAL'}, self.admin)
        started = time.monotonic()
        for c, oid in zip(clients, ids):
            wait_for(f'/orders/{oid}', lambda o: bool(o['trackingNumber']), c['token'], 180)
        self.assertLess(time.monotonic() - started, 180)
        METRICS[-1]['recovery_seconds'] = round(time.monotonic() - started, 3)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('category', choices=['carga', 'estres'])
    args = parser.parse_args()
    try:
        run_suite(Load if args.category == 'carga' else Stress, args.category)
    finally:
        Path(os.environ['QA_RESULTS'], args.category + '.json').write_text(
            json.dumps(METRICS, ensure_ascii=False, indent=2), encoding='utf-8')
