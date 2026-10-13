#!/usr/bin/env python3
"""New operations against real providers: isolated products/customers, no destructive reset."""
from prueba_fase2 import api, wait_for, opaque_token
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import uuid


def main():
    admin = api('/auth/login', 'POST', {'username':'admin','password':'admin123'})['token']
    providers = ['payklik','sat','logiexpress','messaging','pos','erp']
    for provider in providers:
        api('/simulation/'+provider,'PUT',{'mode':'NORMAL'},admin)
    product = api('/products','POST',{'sku':'QA-'+uuid.uuid4().hex[:12], 'name':'Producto QA operaciones','category':'ROPA','price':50},admin)
    api('/products','POST',{'sku':'QA-ZERO-'+uuid.uuid4().hex[:8], 'name':'Precio inválido','category':'ROPA','price':0},admin,expected=400)
    api('/promotions','POST',{'name':'Descuento inválido','category':'ROPA','discountPercent':100,'endsAt':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()},admin,expected=400)
    pid = product['id']
    store = next(s for s in api('/inventory/locations') if s['type_id']==2)
    api('/inventory/movements','POST',{'productId':pid,'locationCode':store['code'],'type':'IN','quantity':30,'reason':'Preparación QA'},admin)
    def client():
        result=api('/customers/register','POST',{'fullName':'Cliente QA operaciones','email':uuid.uuid4().hex+'@example.com','password':'prueba123456'})
        return result['customerId'],result['token']
    customer,token=client()
    def checkout(cid=customer,jwt=token):
        api(f'/customers/{cid}/cart/items','POST',{'productId':pid,'quantity':1,'channel':'WEB'},jwt)
        return api('/orders/checkout','POST',{'customerId':cid,'deliveryAddress':'Retiro','pickupLocationId':store['id'],'channel':'CALL_CENTER'},jwt)['id']
    def pay(oid,method='CARD'):
        result=api(f'/orders/{oid}/payments','POST',{'method':method,'cardToken':opaque_token(),'cardLast4':'4242'},token)
        assert result['result']=='APPROVED',result
        detail=wait_for(f'/orders/{oid}',lambda o:bool(o['trackingNumber']),token)
        ship=api(f'/orders/{oid}/shipment',token=token)
        assert ship['carrier']=='PICKUP' and detail['channel']=='CALL_CENTER',ship
        api(f"/shipments/{ship['id']}/tracking",'POST',{'status':'DELIVERED'},admin)
    def availability():
        return api(f'/inventory/products/{pid}/availability')['totalAvailable']
    def return_order(oid):
        incident=api(f'/orders/{oid}/incidents','POST',{'type':'RETURN','description':'Devolución física QA'},token)
        api(f'/orders/{oid}/incidents','POST',{'type':'RETURN','description':'Duplicada'},token,expected=409)
        api(f"/incidents/{incident['id']}/status",'PUT',{'status':'RESOLVED'},admin)
        api(f"/incidents/{incident['id']}/status",'PUT',{'status':'RESOLVED'},admin,expected=409)
        assert api(f'/orders/{oid}',token=token)['status']=='RETURNED'
        return wait_for(f'/orders/{oid}/refunds',lambda rows:rows and rows[0]['status']=='REFUNDED',token)[0]
    try:
        promotion=api('/promotions','POST',{'name':'QA descuento','description':'Temporal','category':'ROPA','discountPercent':10,'endsAt':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()},admin)
        try:
            assert any(p['id']==promotion['id'] and p['categoriasAplicables']==['ROPA'] for p in api('/promotions'))
            assert float(api(f'/products/{pid}')['price']) <= 45
            oid=checkout()
            assert float(api(f'/orders/{oid}',token=token)['total']) <= 45
            assert availability()==29
            api(f'/orders/{oid}/cancel','POST',{},token)
            api(f'/orders/{oid}/cancel','POST',{},token)
            assert availability()==30
            api(f'/orders/{oid}/payments','POST',{'method':'CARD','cardToken':'tok_cancelled','cardLast4':'4242'},token,expected=409)
        finally:
            api(f"/promotions/{promotion['id']}/active",'PUT',{'active':False},admin)
        print('PASS: real promotions, immutable prices, pickup reservations, channel and idempotent cancellation',flush=True)
        for _ in range(3):
            pay(checkout())
        assert api(f'/customers/{customer}/credit',token=token)['eligible']
        insufficient=checkout()
        old_limit=next(row['value'] for row in api('/settings',token=admin) if row['key']=='credit.limit')
        api('/settings/credit.limit','PUT',{'value':'10'},admin)
        try:
            api(f'/orders/{insufficient}/payments','POST',{'method':'CREDIT'},token,expected=409)
            assert api(f'/orders/{insufficient}',token=token)['status']=='PENDING_PAYMENT'
        finally:
            api('/settings/credit.limit','PUT',{'value':str(old_limit)},admin)
            api(f'/orders/{insufficient}/cancel','POST',{},token)
        print('PASS: credit limit enforced atomically; rejected credit purchase leaves no partial payment',flush=True)
        oid=checkout(); pay(oid,'CREDIT')
        charge=api(f'/customers/{customer}/credit/charges',token=token)[0]
        api('/simulation/payklik','PUT',{'mode':'DOWN'},admin)
        try:
            result=api(f"/customers/{customer}/credit/charges/{charge['id']}/repay",'POST',{'cardToken':'tok_durable_abono'},token)
            assert result['queued'] and not result['paid'],result
        finally:
            api('/simulation/payklik','PUT',{'mode':'NORMAL'},admin)
        wait_for(f'/customers/{customer}/credit/charges',lambda rows:any(c['id']==charge['id'] and c['paid_at'] for c in rows),token)
        assert float(api(f'/customers/{customer}/credit',token=token)['used'])==0
        print('PASS: pickup delivery, earned credit and durable repayment after PayKlik outage',flush=True)
        unpaid=checkout(); pay(unpaid,'CREDIT')
        before=availability(); refund=return_order(unpaid)
        assert refund['provider_reference'].startswith('CREDIT-VOID-')
        assert availability()==before+1
        assert float(api(f'/customers/{customer}/credit',token=token)['used'])==0
        assert not api(f'/customers/{customer}/credit',token=token)['eligible']
        paid=checkout(); pay(paid)
        before=availability()
        api('/simulation/payklik','PUT',{'mode':'DOWN'},admin)
        incident=api(f'/orders/{paid}/incidents','POST',{'type':'RETURN','description':'Reembolso en cola'},token)
        api(f"/incidents/{incident['id']}/status",'PUT',{'status':'RESOLVED'},admin)
        api('/simulation/payklik','PUT',{'mode':'NORMAL'},admin)
        wait_for(f'/orders/{paid}/refunds',lambda rows:rows and rows[0]['status']=='REFUNDED',token)
        assert availability()==before+1
        api('/integration/erp/batches','POST',{},admin)
        wait_for('/integration/erp/batches',lambda rows:any(b['status']=='DELIVERED' for b in rows),admin)
        print('PASS: return inventory restored once, credit void, card refund after outage, ERP return adjustments',flush=True)
        rejected=checkout()
        api('/simulation/payklik','PUT',{'mode':'REJECT'},admin)
        try:
            for _ in range(3):
                assert api(f'/orders/{rejected}/payments','POST',{'method':'CARD','cardToken':opaque_token(),'cardLast4':'4242'},token)['result']=='DECLINED'
            api(f'/orders/{rejected}/payments','POST',{'method':'CARD','cardToken':'tok_fourth','cardLast4':'4242'},token,expected=409)
        finally:
            api('/simulation/payklik','PUT',{'mode':'NORMAL'},admin)
        api(f'/orders/{rejected}/cancel','POST',{},token)
        reservations=api(f'/inventory/reservations?productId={pid}&limit=500',token=admin)
        assert not any(r['orderId']==rejected and r['status'] in ['ACTIVE','CONFIRMED'] for r in reservations)
        # Isolate just two units; ten different checkouts contend for the same store/product.
        api('/inventory/adjustments','POST',{'productId':pid,'locationCode':store['code'],'countedQuantity':2,'source':'QA concurrencia'},admin)
        clients=[client() for _ in range(10)]
        def contend(pair):
            cid,jwt=pair
            try: return checkout(cid,jwt),jwt
            except AssertionError as error:
                assert error.args[0][1]==409,error
                return None
        with ThreadPoolExecutor(max_workers=10) as executor:
            accepted=[r for r in executor.map(contend,clients) if r]
        assert len(accepted)==2,accepted
        assert availability()==0
        for order,jwt in accepted: api(f'/orders/{order}/cancel','POST',{},jwt)
        assert availability()==2
        print('PASS: rejected payment releases stock, server attempt limit, 10 simultaneous checkouts for 2 units without overselling',flush=True)
    finally:
        for provider in providers: api('/simulation/'+provider,'PUT',{'mode':'NORMAL'},admin)
    print('FASE 2 operations checks passed',flush=True)

if __name__=='__main__': main()
