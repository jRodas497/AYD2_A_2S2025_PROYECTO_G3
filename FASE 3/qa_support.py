"""Helpers for real-stack tests. No third-party Python dependencies."""
import json
import os
import subprocess
import sys
import time
import unittest
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'FASE 2' / 'pruebas'))
from prueba_fase2 import api, wait_for, opaque_token  # noqa: E402


def compose(*args, **kwargs):
    return subprocess.run(['docker', 'compose', '-f', os.environ['QA_COMPOSE_FILE'],
                           '-p', os.environ['COMPOSE_PROJECT_NAME'], *args], check=True,
                          encoding='utf-8', **kwargs)


def sql(query):
    return compose('exec', '-T', 'db', 'psql', '-U', 'sgologic', '-d', 'sgologic',
                   '-At', '-v', 'ON_ERROR_STOP=1', '-c', query,
                   capture_output=True).stdout.strip()


def admin_login():
    return api('/auth/login', 'POST', {'username': 'admin', 'password': 'admin123'})['token']


def customer():
    return api('/customers/register', 'POST', {'fullName': 'QA Fase 3',
               'email': uuid.uuid4().hex + '@example.com', 'password': 'prueba123456'})


def history(cid, admin, **changes):
    data = dict(deliveredOrders=5, purchasedAmount=500, latePayments=0,
                overduePayments=0, returns=0, confirmedIncidents=0, declinedPayments=0)
    data.update(changes)
    return api(f'/integration/erp/customers/{cid}/history', 'PUT', data, admin)


def product(admin, quantity=100, price=10):
    p = api('/products', 'POST', {'sku': 'F3-' + uuid.uuid4().hex[:16],
            'name': 'Producto QA Fase 3', 'category': 'CALZADO', 'price': price}, admin)
    loc = next(l for l in api('/inventory/locations') if l['type_id'] == 1)
    api('/inventory/movements', 'POST', {'productId': p['id'], 'locationCode': loc['code'],
        'type': 'IN', 'quantity': quantity, 'reason': 'Fixture QA Fase 3'}, admin)
    return p['id']


def checkout(c, pid, quantity=1, method='CARD'):
    api(f"/customers/{c['customerId']}/cart/items", 'POST',
        {'productId': pid, 'quantity': quantity, 'channel': 'WEB'}, c['token'])
    return api('/orders/checkout', 'POST', {'customerId': c['customerId'],
               'deliveryAddress': 'Zona 10 QA Fase 3', 'paymentMethod': method}, c['token'])['id']


def pay(c, oid, method='CARD', expected=None):
    return api(f'/orders/{oid}/payments', 'POST', {'method': method,
        'cardToken': opaque_token(), 'cardLast4': '4242'}, c['token'], expected)


class XmlResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.subtest_failures = {}

    def addSubTest(self, test, subtest, error):
        super().addSubTest(test, subtest, error)
        if error is not None:
            self.subtest_failures.setdefault(test.id(), []).append(self._exc_info_to_string(error, subtest))

    def startTest(self, test):
        self.started = time.monotonic()
        super().startTest(test)

    def stopTest(self, test):
        node = ET.SubElement(self.xml, 'testcase', name=test.id(),
                             time=f'{time.monotonic() - self.started:.3f}')
        for kind, entries in [('failure', self.failures), ('error', self.errors)]:
            for failed, detail in entries:
                if failed is test:
                    ET.SubElement(node, kind).text = detail
        for skipped, reason in self.skipped:
            if skipped is test:
                ET.SubElement(node, 'skipped').text = reason
        for detail in self.subtest_failures.get(test.id(), []):
            ET.SubElement(node, 'failure').text = detail
        super().stopTest(test)


def run_suite(case, name):
    out = Path(os.environ.get('QA_RESULTS', Path(__file__).parent / 'resultados'))
    out.mkdir(parents=True, exist_ok=True)
    XmlResult.xml = ET.Element('testsuite', name=name)
    result = unittest.TextTestRunner(verbosity=2, resultclass=XmlResult).run(
        unittest.defaultTestLoader.loadTestsFromTestCase(case))
    result.xml.set('tests', str(result.testsRun))
    result.xml.set('failures', str(len(result.failures)))
    result.xml.set('errors', str(len(result.errors)))
    ET.ElementTree(result.xml).write(out / (name + '.xml'), encoding='utf-8', xml_declaration=True)
    if not result.wasSuccessful() or result.testsRun < 5 or result.skipped:
        raise SystemExit(1)
