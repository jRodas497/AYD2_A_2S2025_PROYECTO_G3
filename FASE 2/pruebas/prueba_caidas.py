#!/usr/bin/env python3
"""Stops real Compose containers; always restores them. Run in an isolated demo stack."""
from prueba_fase2 import api, wait_for
from pathlib import Path
import subprocess
import time
import uuid

COMPOSE = str(Path(__file__).resolve().parents[1] / 'docker-compose.yml')

def docker(*args):
    subprocess.run(['docker','compose','-f',COMPOSE,*args],check=True,stdout=subprocess.DEVNULL)


def main():
    admin=api('/auth/login','POST',{'username':'admin','password':'admin123'})['token']
    providers=['payklik','sat','logiexpress','messaging','pos','erp']
    for provider in providers: api('/simulation/'+provider,'PUT',{'mode':'NORMAL'},admin)
    result=api('/customers/register','POST',{'fullName':'QA caídas reales','email':uuid.uuid4().hex+'@example.com','password':'prueba123456'})
    token,cid=result['token'],result['customerId']
    product=api('/products','POST',{'sku':'QA-CAIDA-'+uuid.uuid4().hex[:10],'name':'Producto QA caídas','category':'CALZADO','price':10},admin)['id']
    location=next(l for l in api('/inventory/locations') if l['type_id']==1)
    api('/inventory/movements','POST',{'productId':product,'locationCode':location['code'],'type':'IN','quantity':20,'reason':'Preparación prueba de caídas'},admin)
    def buy():
        api(f'/customers/{cid}/cart/items','POST',{'productId':product,'quantity':1,'channel':'WEB'},token)
        oid=api('/orders/checkout','POST',{'customerId':cid,'deliveryAddress':'QA recuperación Docker'},token)['id']
        api(f'/orders/{oid}/payments','POST',{'method':'CARD','cardToken':'tok_'+uuid.uuid4().hex,'cardLast4':'4242'},token)
        return oid
    def dispatched(oid):
        return wait_for(f'/orders/{oid}',lambda order:bool(order['trackingNumber']),token,seconds=180)
    try:
        docker('stop','kafka')
        oid=buy()
        assert api(f'/orders/{oid}',token=token)['status']=='PAID'
        docker('start','kafka')
        dispatched(oid)
        print('PASS: real Kafka stop retains paid order; broker restart resumes invoice and guide',flush=True)
        for provider in ['payklik','sat','logiexpress']:
            docker('stop',provider)
            oid=buy()
            time.sleep(3)
            assert not api(f'/orders/{oid}',token=token)['trackingNumber']
            docker('start',provider)
            dispatched(oid)
            print('PASS: real '+provider+' container stop/start recovers automatically',flush=True)
        docker('stop','messaging','pos')
        oid=buy(); dispatched(oid)
        docker('start','messaging','pos')
        wait_for(f'/orders/{oid}/notifications',lambda rows:rows and all(n['status']=='DELIVERED' for n in rows),token)
        wait_for('/integration/health',lambda h:h['pos']['PENDING']==0,admin,seconds=120)
        print('PASS: messaging/POS container outages preserve checkout and recover independently',flush=True)
        api('/simulation/messaging','PUT',{'mode':'DOWN'},admin)
        oid=buy(); dispatched(oid)
        failed=wait_for(f'/orders/{oid}/notifications',lambda rows:any(n['status']=='FAILED' for n in rows),token,seconds=180)
        assert any(n['attempts']==8 and n['lastError'] for n in failed if n['status']=='FAILED'),failed
        print('PASS: 8 Kafka attempts exhaust into the dead-letter state without losing the order',flush=True)
        api('/simulation/messaging','PUT',{'mode':'NORMAL'},admin)
        for notification in failed:
            if notification['status']=='FAILED': api(f"/notifications/{notification['id']}/retry",'POST',{},admin)
        # Some later notifications can reach their DLT a few seconds after the first one.
        for _ in range(15):
            rows=api(f'/orders/{oid}/notifications',token=token)
            for row in rows:
                if row['status']=='FAILED': api(f"/notifications/{row['id']}/retry",'POST',{},admin)
            if all(row['status']=='DELIVERED' for row in rows): break
            time.sleep(2)
        wait_for(f'/orders/{oid}/notifications',lambda rows:rows and all(n['status']=='DELIVERED' for n in rows),token)
        print('PASS: operator replay from DLT delivers the original notifications',flush=True)
    finally:
        docker('start','kafka',*providers)
        for provider in providers: api('/simulation/'+provider,'PUT',{'mode':'NORMAL'},admin)
    print('FASE 2 real container resilience checks passed',flush=True)

if __name__=='__main__': main()
