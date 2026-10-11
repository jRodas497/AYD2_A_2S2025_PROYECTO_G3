#!/usr/bin/env python3
"""Contract + resilience checks against the real Compose stack; stdlib only."""
import concurrent.futures
import json
import os
import time
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('SGO_URL', 'http://localhost:8081')


def api(path, method='GET', data=None, token=None, expected=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(BASE + '/api' + path,
                                     data=None if data is None else json.dumps(data).encode(),
                                     headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status, raw = response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read().decode()
    if expected is not None:
        assert status == expected, (path, status, raw)
    elif status >= 400:
        raise AssertionError((path, status, raw))
    try:
        return json.loads(raw)
    except ValueError:
        return raw


def wait_for(path, predicate, token, seconds=90):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = api(path, token=token)
        if predicate(result):
            return result
        time.sleep(1)
    raise AssertionError(('timeout', path, result))


def main():
    admin = api('/auth/login', 'POST', {'username': 'admin', 'password': 'admin123'})['token']
    for provider in ['payklik', 'sat', 'logiexpress', 'messaging', 'pos', 'erp']:
        api('/simulation/' + provider, 'PUT', {'mode': 'NORMAL'}, admin)
    client = api('/customers/register', 'POST', {'fullName': 'Prueba integral FASE 2',
                 'email': 'fase2-' + uuid.uuid4().hex + '@example.com', 'password': 'prueba123456'})
    token, customer = client['token'], client['customerId']
    product = api('/products','POST',{'sku':'QA-FLUJO-'+uuid.uuid4().hex[:10], 'name':'Producto de prueba de flujo', 'category':'CALZADO','price':10},admin)
    location = next(l for l in api('/inventory/locations') if l['type_id']==1)
    api('/inventory/movements','POST',{'productId':product['id'],'locationCode':location['code'],'type':'IN','quantity':30,'reason':'Preparación prueba integral'},admin)

    def checkout(channel='WEB'):
        api(f'/customers/{customer}/cart/items', 'POST', {'productId': product['id'], 'quantity': 1, 'channel': channel}, token)
        return api('/orders/checkout', 'POST', {'customerId': customer, 'deliveryAddress': 'Zona 10, prueba automatizada'}, token)['id']

    def pay(order):
        return api(f'/orders/{order}/payments', 'POST', {'method': 'CARD', 'cardToken': 'tok_' + uuid.uuid4().hex, 'cardLast4': '4242'}, token)

    def dispatched(order):
        return wait_for(f'/orders/{order}', lambda o: bool(o['trackingNumber']), token)

    api('/integration/health', expected=401)
    api(f'/customers/{customer + 1}', token=token, expected=403)
    api('/orders/checkout', 'POST', {'customerId': customer + 1, 'deliveryAddress': 'ajeno'}, token, expected=403)
    assert not api(f'/customers/{customer}/credit', token=token)['eligible']
    api('/settings/payment.timeout_ms', 'PUT', {'value': '-1'}, admin, expected=400)
    print('PASS: authentication, ownership, new-customer credit rejection and setting validation', flush=True)

    order = checkout('MOBILE')
    api(f'/orders/{order}/payments', 'POST', {'method': 'CARD', 'cardToken': '4111111111111111', 'cardLast4': '1111'}, token, expected=400)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(pay, order) for _ in range(2)]
        results = []
        for future in futures:
            try:
                results.append(future.result()['result'])
            except AssertionError as error:
                assert error.args[0][1] == 409, error
                results.append('CONFLICT')
    assert results.count('APPROVED') == 1, results
    detail = dispatched(order)
    assert detail['items'] and detail['deliveryAddress'] and detail['channel'] == 'MOBILE'
    assert api(f'/orders/{order}/invoice', token=token)['status'] == 'ACCEPTED'
    wait_for(f'/orders/{order}/notifications', lambda rows: rows and all(n['status'] == 'DELIVERED' for n in rows), token)
    shipment = api(f'/orders/{order}/shipment', token=token)
    api(f"/shipments/{shipment['id']}/tracking", 'POST', {'status': 'DELIVERED', 'detail': 'Entrega verificada'}, admin)
    api(f"/shipments/{shipment['id']}/tracking", 'POST', {'status': 'IN_TRANSIT'}, admin, expected=409)
    assert api(f'/orders/{order}', token=token)['status'] == 'DELIVERED'
    print('PASS: concurrent payment, immutable order details, invoice, guide, notifications, delivery transitions', flush=True)

    # Each failing external provider retains the sale; restoring the container state resumes it.
    for provider, mode in [('payklik', 'DOWN'), ('sat', 'REJECT'), ('logiexpress', 'DOWN'), ('payklik', 'SLOW')]:
        api('/simulation/' + provider, 'PUT', {'mode': mode}, admin)
        try:
            order = checkout()
            result = pay(order)
            if provider == 'payklik':
                assert result['orderStatus'] == 'PAYMENT_IN_PROGRESS', result
            else:
                time.sleep(4)
        finally:
            api('/simulation/' + provider, 'PUT', {'mode': 'NORMAL'}, admin)
        dispatched(order)
        print(f'PASS: {provider} {mode} recovered automatically through Kafka', flush=True)

    # Trust is earned: three clean deliveries enable credit, which follows the same fiscal flow.
    history = api(f'/customers/{customer}/orders', token=token)
    for overview in history:
        if overview['status'] == 'IN_DISPATCH':
            shipment = api(f"/orders/{overview['orderId']}/shipment", token=token)
            api(f"/shipments/{shipment['id']}/tracking", 'POST', {'status': 'DELIVERED'}, admin)
    account = api(f'/customers/{customer}/credit', token=token)
    assert account['eligible'], account
    order = checkout()
    result = api(f'/orders/{order}/payments', 'POST', {'method': 'CREDIT'}, token)
    assert result['result'] == 'APPROVED'
    dispatched(order)
    charge = api(f'/customers/{customer}/credit/charges', token=token)[0]
    assert charge['paid_at'] is None
    for _ in range(2):
        assert api(f"/customers/{customer}/credit/charges/{charge['id']}/repay", 'POST', {'cardToken': 'tok_repay'}, token)['paid']
    assert float(api(f'/customers/{customer}/credit', token=token)['used']) == 0
    print('PASS: earned credit, credit purchase, billing, repayment and duplicate repayment', flush=True)

    api('/simulation/erp', 'PUT', {'mode': 'DOWN'}, admin)
    try:
        batch = api('/integration/erp/batches', 'POST', {}, admin)
        assert batch['generated'], batch
        batch_id = batch['batch']['id']
        content = api(f'/integration/erp/batches/{batch_id}/file', token=admin)
        assert str(order) in content
    finally:
        api('/simulation/erp', 'PUT', {'mode': 'NORMAL'}, admin)
    wait_for('/integration/erp/batches', lambda rows: any(b['id'] == batch_id and b['status'] == 'DELIVERED' for b in rows), admin)
    wait_for('/integration/health', lambda h: h['pos']['PENDING'] == 0, admin)
    print('PASS: ERP outage recovery, structured sales file, 32-store POS delivery', flush=True)
    print('FASE 2 integration checks passed', flush=True)


if __name__ == '__main__':
    main()
