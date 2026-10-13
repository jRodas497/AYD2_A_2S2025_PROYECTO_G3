"""Credit decisions use the real ERP, PostgreSQL, Kafka and provider containers."""
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from qa_support import (admin_login, api, checkout, customer, history, pay,
                        product, run_suite, sql, wait_for)


class CreditIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin = admin_login()
        cls.pid = product(cls.admin, 100, 10)

    def setUp(self):
        self.c = customer()
        self.cid, self.token = self.c['customerId'], self.c['token']
        for p in ['payklik', 'sat', 'logiexpress', 'messaging', 'erp', 'pos']:
            api('/simulation/' + p, 'PUT', {'mode': 'NORMAL'}, self.admin)

    def account(self):
        return api(f'/customers/{self.cid}/credit', token=self.token)

    def test_I01_erp_history_enables_credit_with_30_day_term(self):
        history(self.cid, self.admin)
        account = self.account()
        self.assertTrue(account['eligible'])
        self.assertEqual(account['termDays'], 30)
        self.assertEqual(account['deliveredOrders'], 5)
        self.assertEqual(float(account['purchasedAmount']), 500)

    def test_I02_new_customer_denial_is_durable_and_card_still_works(self):
        oid = checkout(self.c, self.pid, method='CREDIT')
        pay(self.c, oid, 'CREDIT', expected=409)
        applications = api(f'/customers/{self.cid}/credit/applications', token=self.token)
        self.assertEqual(applications[0]['status'], 'DECLINED')
        self.assertEqual(sql(f'select count(*) from payments.credit_charge where order_id={oid}'), '0')
        self.assertEqual(api(f'/orders/{oid}', token=self.token)['status'], 'PENDING_PAYMENT')
        self.assertEqual(pay(self.c, oid)['result'], 'APPROVED')
        wait_for(f'/orders/{oid}', lambda o: bool(o['trackingNumber']), self.token)
        rows = wait_for(f'/orders/{oid}/notifications',
                        lambda r: any('rechazada' in n['message'] for n in r), self.token)
        self.assertTrue(rows)

    def test_I03_erp_risk_factors_each_block_credit(self):
        for field in ['latePayments', 'overduePayments', 'returns', 'confirmedIncidents', 'declinedPayments']:
            with self.subTest(field=field):
                history(self.cid, self.admin, **{field: 1})
                account = self.account()
                self.assertFalse(account['eligible'], field)
                oid = checkout(self.c, self.pid)
                pay(self.c, oid, 'CREDIT', expected=409)
                api(f'/orders/{oid}/cancel', 'POST', {}, self.token)

    def test_I04_credit_and_card_converge_on_invoice_guide_and_notification(self):
        history(self.cid, self.admin)
        for method in ['CREDIT', 'CARD']:
            with self.subTest(method=method):
                oid = checkout(self.c, self.pid, method=method)
                self.assertEqual(pay(self.c, oid, method)['result'], 'APPROVED')
                wait_for(f'/orders/{oid}', lambda o: bool(o['trackingNumber']), self.token)
                self.assertEqual(api(f'/orders/{oid}/invoice', token=self.token)['status'], 'ACCEPTED')
                wait_for(f'/orders/{oid}/notifications',
                         lambda r: bool(r) and all(n['status'] == 'DELIVERED' for n in r), self.token)
                self.assertTrue(api(f'/orders/{oid}/trace', token=self.admin))

    def test_I05_credit_limit_concurrent_requests_cannot_overspend(self):
        history(self.cid, self.admin)
        limit = float(self.account()['available'])
        expensive = product(self.admin, 3, limit * 0.6)
        ids = [checkout(self.c, expensive) for _ in range(2)]
        def request(oid):
            try:
                return pay(self.c, oid, 'CREDIT')['result']
            except AssertionError as error:
                self.assertEqual(error.args[0][1], 409)
                return 'DECLINED'
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(request, ids))
        self.assertEqual(sorted(outcomes), ['APPROVED', 'DECLINED'])
        self.assertLessEqual(float(self.account()['used']), limit)
        self.assertEqual(sql(f'select count(*) from payments.credit_charge where customer_id={self.cid}'), '1')

    def test_I06_stale_erp_down_is_bounded_and_card_remains_available(self):
        history(self.cid, self.admin)
        sql(f"update integration.erp_customer_history set fetched_at=now()-interval '6 minutes' where customer_id={self.cid}")
        api('/simulation/erp', 'PUT', {'mode': 'DOWN'}, self.admin)
        try:
            started = time.monotonic()
            self.assertFalse(self.account()['eligible'])
            self.assertLess(time.monotonic() - started, 2)
            oid = checkout(self.c, self.pid)
            pay(self.c, oid, 'CREDIT', expected=409)
            self.assertEqual(pay(self.c, oid)['result'], 'APPROVED')
        finally:
            api('/simulation/erp', 'PUT', {'mode': 'NORMAL'}, self.admin)
        self.assertTrue(self.account()['eligible'])

    def test_I07_approved_credit_survives_payklik_down(self):
        history(self.cid, self.admin)
        api('/simulation/payklik', 'PUT', {'mode': 'DOWN'}, self.admin)
        try:
            oid = checkout(self.c, self.pid, method='CREDIT')
            self.assertEqual(pay(self.c, oid, 'CREDIT')['result'], 'APPROVED')
            wait_for(f'/orders/{oid}', lambda o: bool(o['trackingNumber']), self.token)
        finally:
            api('/simulation/payklik', 'PUT', {'mode': 'NORMAL'}, self.admin)

    def test_I08_history_is_protected_and_invalid_import_rejected(self):
        api(f'/integration/erp/customers/{self.cid}/history', token=self.token, expected=403)
        with self.assertRaises(AssertionError) as rejected:
            history(self.cid, self.admin, purchasedAmount=-1)
        self.assertEqual(rejected.exception.args[0][1], 400)
        another = customer()
        api(f'/customers/{self.cid}/credit', token=another['token'], expected=403)
        self.assertEqual(sql(f'select count(*) from integration.erp_customer_history where customer_id={self.cid}'), '0')


if __name__ == '__main__':
    run_suite(CreditIntegration, 'integracion')
