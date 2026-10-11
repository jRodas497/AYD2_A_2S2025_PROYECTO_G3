#!/usr/bin/env python3
"""Staff roles are rechecked on every request; a disabled token loses access immediately."""
from prueba_fase2 import api
import uuid


def main():
    admin=api('/auth/login','POST',{'username':'admin','password':'admin123'})['token']
    username='qa-'+uuid.uuid4().hex[:12]
    worker=api('/users','POST',{'username':username,'fullName':'QA permisos','email':username+'@example.com','password':'prueba123456','roles':['FINANCE']},admin)
    token=api('/auth/login','POST',{'username':username,'password':'prueba123456'})['token']
    try:
        for endpoint in ['/users','/customers','/orders','/invoices','/incidents','/audit','/reports/sales','/settings','/auth/me']:
            api(endpoint,expected=401)
        assert api('/auth/me',token=token)['roles']==['FINANCE']
        api('/integration/health',token=token)
        api('/settings',token=token,expected=403)
        api('/settings/credit.limit','PUT',{'value':'10'},token,expected=403)
        api('/users',token=token,expected=403)
        api('/simulation',token=token,expected=403)
        api('/inventory/movements','POST',{'productId':1,'locationCode':'CD1','type':'IN','quantity':1,'reason':'No autorizado'},token,expected=403)
        for roles in [['LOGISTICS'],['CALL_CENTER_AGENT'],['STORE_EMPLOYEE'],['STORE_MANAGER']]:
            api(f"/users/{worker['id']}/roles",'PUT',{'roles':roles+roles},admin)
            assert api('/auth/me',token=token)['roles']==roles
            api('/orders',token=token)
            api('/users',token=token,expected=403)
            api('/settings',token=token,expected=403)
            api('/reports/sales',token=token,expected=403)
            api('/audit',token=token,expected=403)
            if roles==['LOGISTICS']:
                api('/integration/health',token=token)
                api('/customers',token=token,expected=403)
                api('/incidents/1/status','PUT',{'status':'RESOLVED'},token,expected=403)
                api('/integration/erp/batches',token=token,expected=403)
            else:
                api('/customers',token=token)
                api('/integration/health',token=token,expected=403)
        api(f"/users/{worker['id']}",'PUT',{'fullName':'QA datos editados','email':username+'@example.com','storeId':None,'roles':['FINANCE']},admin)
        assert api('/auth/me',token=token)['roles']==['FINANCE']
        api(f"/users/{worker['id']}/roles",'PUT',{'roles':[]},admin,expected=400)
        api(f"/users/{worker['id']}/roles",'PUT',{'roles':[None]},admin,expected=400)
        api(f"/users/{worker['id']}/password",'PUT',{'password':'corta'},admin,expected=400)
        api(f"/users/{worker['id']}/password",'PUT',{'password':'nueva123456'},admin)
        api('/auth/me',token=token,expected=401)
        api('/auth/login','POST',{'username':username,'password':'prueba123456'},expected=401)
        token=api('/auth/login','POST',{'username':username,'password':'nueva123456'})['token']
        api(f"/users/{worker['id']}/active",'PUT',{'active':False},admin)
        api('/auth/me',token=token,expected=401)
        api('/auth/login','POST',{'username':username,'password':'nueva123456'},expected=401)
        api(f"/users/{worker['id']}/active",'PUT',{'active':True},admin)
        api('/auth/me',token=token,expected=401)
        admin_user=next(u for u in api('/users',token=admin) if u['username']=='admin')
        active_admins=[u for u in api('/users',token=admin) if u['active'] and 'ADMIN' in u['roles']]
        if len(active_admins)==1:
            api(f"/users/{admin_user['id']}/active",'PUT',{'active':False},admin,expected=409)
            api(f"/users/{admin_user['id']}/roles",'PUT',{'roles':['FINANCE']},admin,expected=409)
        customer=api('/customers/register','POST',{'fullName':'QA cliente permisos','email':uuid.uuid4().hex+'@example.com','password':'prueba123456'})
        for endpoint in ['/users','/customers','/orders','/invoices','/incidents','/audit','/reports/sales','/settings','/auth/me']:
            api(endpoint,token=customer['token'],expected=403)
        api('/customers','POST',{'fullName':'No autorizado'},customer['token'],expected=403)
        api('/providers/logiexpress/tracking','POST',{'shipmentId':1,'status':'DELIVERED'},expected=401)
    finally:
        api(f"/users/{worker['id']}/active",'PUT',{'active':False},admin)
    print('PASS: guest/customer denial, all staff roles, live role changes, user edits, password reset, durable session revocation, last administrator and signed carrier boundary',flush=True)

if __name__=='__main__': main()
