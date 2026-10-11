#!/usr/bin/env python3
"""Regression checks for reservations, consolidation, exchanges, store scope and account recovery."""
import hashlib
import json
import re
import subprocess
import time
import uuid
from pathlib import Path
from prueba_fase2 import api, wait_for

COMPOSE=str(Path(__file__).resolve().parents[1]/"docker-compose.yml")


def sql(query):
    return subprocess.check_output(['docker','exec','sgologic-db','psql','-U','sgologic','-d','sgologic','-At','-v','ON_ERROR_STOP=1','-c',query],text=True).strip()


def provider_records(provider):
    raw=subprocess.check_output(['docker','compose','-f',COMPOSE,'exec','-T',provider,'python','-c',
        "import urllib.request;print(urllib.request.urlopen('http://localhost:8090/records').read().decode())"],text=True)
    return json.loads(raw)


def main():
    admin=api('/auth/login','POST',{'username':'admin','password':'admin123'})['token']
    locations=api('/inventory/locations')
    centers=[l for l in locations if l['type_id']==1]
    stores=[l for l in locations if l['type_id']==2]
    created=[]
    workers=[]
    def mode(p,m):api('/simulation/'+p,'PUT',{'mode':m},admin)
    def client():
        email='pendientes-'+uuid.uuid4().hex+'@example.com'
        c=api('/customers/register','POST',{'fullName':'QA cierre de pendientes','email':email,'password':'prueba123456'})
        created.append(c['customerId']);return c['customerId'],c['token'],email
    def product(location):
        p=api('/products','POST',{'sku':'QA-CIERRE-'+uuid.uuid4().hex[:10],'name':'Producto QA cierre','category':'ROPA','price':10},admin)
        api('/inventory/movements','POST',{'locationCode':location['code'],'productId':p['id'],'type':'IN','quantity':30,'reason':'Preparación QA cierre'},admin)
        return p['id']
    def checkout(cid,token,products,pickup=None):
        for pid in products:api(f'/customers/{cid}/cart/items','POST',{'productId':pid,'quantity':1,'channel':'WEB'},token)
        return api('/orders/checkout','POST',{'customerId':cid,'deliveryAddress':'QA cierre','pickupLocationId':pickup,'channel':'CALL_CENTER'},token)['id']
    def pay(oid,token,method='CARD'):
        api(f'/orders/{oid}/payments','POST',{'method':method,'cardToken':'tok_'+uuid.uuid4().hex,'cardLast4':'4242'},token)
        wait_for(f'/orders/{oid}',lambda o:bool(o['trackingNumber']),token)
        return api(f'/orders/{oid}/shipment',token=token)
    try:
        for p in ['payklik','sat','logiexpress','messaging','pos','erp']:mode(p,'NORMAL')
        cid,token,email=client()
        p1,p2=product(centers[0]),product(centers[1])
        order=checkout(cid,token,[p1])
        mode('payklik','DOWN')
        subprocess.run(['docker','compose','-f',COMPOSE,'stop','kafka'],check=True,stdout=subprocess.DEVNULL)
        try:
            outcome=api(f'/orders/{order}/payments','POST',{'method':'CARD','cardToken':'tok_temporal_'+uuid.uuid4().hex,'cardLast4':'4242'},token)
            assert outcome['orderStatus']=='PAYMENT_IN_PROGRESS',outcome
            assert sql(f'select min(status_id) from inventory.reservation where order_id={order}')=='1'
            sql(f"update inventory.reservation set created_at=now()-interval '2 minutes', expires_at=now()-interval '1 minute' where order_id={order} and status_id=1")
            deadline=time.monotonic()+40
            while sql(f'select min(status_id) from inventory.reservation where order_id={order}')!='4':
                assert time.monotonic()<deadline,'La reserva impagada no venció';time.sleep(1)
            assert api(f'/inventory/products/{p1}/availability')['totalAvailable']==30
        finally:
            mode('payklik','NORMAL')
            subprocess.run(['docker','compose','-f',COMPOSE,'start','kafka'],check=True,stdout=subprocess.DEVNULL)
        wait_for(f'/orders/{order}',lambda o:bool(o['trackingNumber']),token,seconds=120)
        print('PASS: unpaid reservations expire during a real Kafka/PayKlik outage and payment recovers',flush=True)

        order=checkout(cid,token,[p1,p2])
        assert sql(f'select count(distinct location_id) from inventory.reservation where order_id={order}')=='2'
        shipment=pay(order,token)
        assert sql(f'select count(distinct location_id) from inventory.reservation where order_id={order}')=='1'
        assert sql(f"select count(*) from inventory.reservation r join logistics.shipment s on s.order_id=r.order_id where r.order_id={order} and r.location_id<>s.origin_location_id")=='0'
        assert sql(f"select count(*) from inventory.stock_movement where order_id={order} and reason like 'Traslado%'")=='1'
        print('PASS: merchandise from two distribution centers is consolidated with auditable transfers',flush=True)

        for pid in [p1,p2]:api('/inventory/movements','POST',{'locationCode':stores[0]['code'],'productId':pid,'type':'IN','quantity':5,'reason':'QA reasignación'},admin)
        old_guide=shipment['trackingNumber']
        mode('logiexpress','DOWN')
        try:
            reassigned=api(f"/shipments/{shipment['id']}/origin",'PUT',{'locationCode':stores[0]['code']},admin)
            assert reassigned['trackingNumber'] is None
            assert int(sql(f"select count(*) from integration.outbox where event_type='ShipmentGuideRequested' and aggregate_id={order}"))>=2
        finally:mode('logiexpress','NORMAL')
        shipment=wait_for(f"/shipments/{shipment['id']}",lambda s:s['trackingNumber'] and s['trackingNumber']!=old_guide,admin)
        print('PASS: reassigned guides recover automatically through a new durable Kafka event',flush=True)

        incident=api(f'/orders/{order}/incidents','POST',{'type':'EXCHANGE','description':'Reemplazo QA completo'},token)
        api(f"/incidents/{incident['id']}/status",'PUT',{'status':'RESOLVED'},admin,expected=409)
        replacement=api(f"/incidents/{incident['id']}/exchange",'POST',{'productId':p2,'quantity':2},admin)
        duplicate=api(f"/incidents/{incident['id']}/exchange",'POST',{'productId':p2,'quantity':2},admin)
        assert duplicate['id']==replacement['id']
        assert api(f'/orders/{order}',token=token)['status']=='RETURNED'
        assert api(f"/incidents/{incident['id']}",token=admin)['replacementOrderId']==replacement['id']
        wait_for(f'/orders/{order}/refunds',lambda r:r and r[0]['status']=='REFUNDED',token)
        assert replacement['status']=='PENDING_PAYMENT'
        pay(replacement['id'],token)
        assert sql(f'select count(*) from payments.refund where order_id={order}')=='1'
        print('PASS: exchanges create one linked replacement order, reserve merchandise and refund the original once',flush=True)

        username='scope-'+uuid.uuid4().hex[:10]
        worker=api('/users','POST',{'username':username,'fullName':'QA alcance tienda','password':'personal123','storeId':stores[0]['id'],'roles':['STORE_EMPLOYEE']},admin)
        workers.append(worker['id'])
        staff=api('/auth/login','POST',{'username':username,'password':'personal123'})['token']
        assert api('/auth/me',token=staff)['storeCode']==stores[0]['code']
        movement={'locationCode':stores[0]['code'],'productId':p1,'type':'IN','quantity':1,'reason':'QA operador real'}
        api('/inventory/movements','POST',movement,staff)
        movement['locationCode']=stores[1]['code']
        api('/inventory/movements','POST',movement,staff,expected=403)
        api('/inventory/adjustments','POST',{'locationCode':stores[1]['code'],'productId':p1,'countedQuantity':100,'source':'Nombre falsificado'},staff,expected=403)
        assert sql(f"select actor from audit.audit_log where action='INVENTARIO_ENTRADA' and details->>'motivo'='QA operador real' order by id desc limit 1")==username
        print('PASS: store scope blocks foreign mutations and audit identifies the authenticated operator',flush=True)

        # Exhaust all real Kafka retry topics, then replay the same durable credit intent.
        cc,ct,_=client()
        cp=product(stores[0])
        for _ in range(3):
            oid=checkout(cc,ct,[cp],stores[0]['id']);sh=pay(oid,ct)
            api(f"/shipments/{sh['id']}/tracking",'POST',{'status':'DELIVERED'},admin)
        oid=checkout(cc,ct,[cp],stores[0]['id']);pay(oid,ct,'CREDIT')
        charge=api(f'/customers/{cc}/credit/charges',token=ct)[0]
        mode('payklik','DOWN')
        try:
            assert api(f"/customers/{cc}/credit/charges/{charge['id']}/repay",'POST',{'cardToken':'tok_replay_'+uuid.uuid4().hex},ct)['queued']
            print('CHECK: waiting for all eight real Kafka repayment retries to reach the dead-letter queue',flush=True)
            rows=wait_for('/integration/outbox?status=FAILED&limit=500',lambda r:any(e['eventType']=='CreditRepaymentRequested' and e['aggregateId']==charge['id'] for e in r),admin,seconds=210)
            failed=next(e for e in rows if e['eventType']=='CreditRepaymentRequested' and e['aggregateId']==charge['id'])
            current=api(f'/customers/{cc}/credit/charges',token=ct)[0]
            assert current['repayment_reference']=='PENDING' and current['repayment_error']
        finally:mode('payklik','NORMAL')
        api(f"/integration/outbox/{failed['id']}/retry",'POST',token=admin)
        charges=wait_for(f'/customers/{cc}/credit/charges',lambda r:r[0]['paid_at'] is not None,ct)
        assert charges[0]['repayment_error'] is None
        assert len([r for r in provider_records('payklik') if r['key']=='charge-'+str(-charge['id'])])==1
        print('PASS: repayment survives retry exhaustion and admin replay collects exactly once',flush=True)

        account,session,email=client()
        known=api('/customers/password/forgot','POST',{'email':email},expected=202)
        assert known==api('/customers/password/forgot','POST',{'email':uuid.uuid4().hex+'@example.com'},expected=202)
        deadline=time.monotonic()+40
        recovery=None
        while recovery is None:
            matches=[r for r in provider_records('messaging') if r['request'].get('recipient')==email]
            if matches:recovery=re.search(r'token=([a-zA-Z0-9-]+)',matches[0]['request']['message']).group(1)
            else:assert time.monotonic()<deadline,'El correo no fue entregado';time.sleep(1)
        assert sql(f"select token_encrypted from customers.password_reset where token_hash='{hashlib.sha256(recovery.encode()).hexdigest()}'")!=recovery
        api('/customers/password/reset','POST',{'token':recovery,'password':'nueva123456'})
        api('/customers/password/reset','POST',{'token':recovery,'password':'otra123456'},expected=400)
        api(f'/customers/{account}',token=session,expected=401)
        session=api('/customers/login','POST',{'email':email,'password':'nueva123456'})['token']
        api(f'/customers/{account}/password','PUT',{'currentPassword':'incorrecta','password':'final123456'},session,expected=400)
        api(f'/customers/{account}/password','PUT',{'currentPassword':'nueva123456','password':'final123456'},session)
        api(f'/customers/{account}',token=session,expected=401)
        session=api('/customers/login','POST',{'email':email,'password':'final123456'})['token']
        api(f'/customers/{account}/active','PUT',{'active':False},admin)
        api(f'/customers/{account}',token=session,expected=401)
        api('/customers/login','POST',{'email':email,'password':'final123456'},expected=401)
        api(f'/customers/{account}/active','PUT',{'active':True},admin)
        api(f'/customers/{account}',token=session,expected=401)
        assert api('/customers/login','POST',{'email':email,'password':'final123456'})['token']
        print('PASS: encrypted one-use email recovery, password changes and durable customer session revocation',flush=True)
    finally:
        subprocess.run(['docker','compose','-f',COMPOSE,'start','kafka'],stdout=subprocess.DEVNULL,check=True)
        for p in ['payklik','sat','logiexpress','messaging','pos','erp']:mode(p,'NORMAL')
        for uid in workers:api(f'/users/{uid}/active','PUT',{'active':False},admin)
        for cid in created:api(f'/customers/{cid}/active','PUT',{'active':False},admin)


if __name__=='__main__':main()
