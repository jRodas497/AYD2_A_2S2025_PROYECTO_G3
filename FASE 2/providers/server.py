"""Independent, durable third-party test doubles. No commerce code runs here."""
import hashlib
import json
import os
import sqlite3
import time
import urllib.request
import urllib.error
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROVIDER = os.environ['PROVIDER']
DATA = Path(os.environ.get('DATA_DIR', '/data'))
DATA.mkdir(parents=True, exist_ok=True)


def db():
    con = sqlite3.connect(DATA / 'provider.sqlite', timeout=30)
    con.execute('create table if not exists records (key text primary key, request text, response text)')
    con.execute('create table if not exists settings (key text primary key, value text)')
    con.execute('create table if not exists customer_history (customer text primary key, history text not null)')
    return con


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def respond(self, status, body):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('X-Provider', PROVIDER)
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        with db() as con:
            row = con.execute("select value from settings where key='mode'").fetchone()
            mode = row[0] if row else 'NORMAL'
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == '/history' and PROVIDER == 'erp':
                if mode == 'DOWN': return self.respond(503, {'message': 'ERP no disponible'})
                if mode == 'SLOW':
                    time.sleep(6)
                    return self.respond(504, {'message': 'ERP excedió el tiempo de espera'})
                if mode == 'REJECT': return self.respond(422, {'message': 'consulta ERP rechazada'})
                customer = urllib.parse.parse_qs(parsed.query).get('customer', [''])[0]
                row = con.execute('select history from customer_history where customer=?', (customer,)).fetchone()
                empty = dict(deliveredOrders=0, purchasedAmount=0, latePayments=0, overduePayments=0, returns=0, confirmedIncidents=0, declinedPayments=0)
                return self.respond(200, json.loads(row[0]) if row else empty)
            if self.path == '/health':
                return self.respond(200, {'provider': PROVIDER, 'mode': mode})
            if self.path == '/records':
                rows = con.execute('select key, request, response from records order by rowid desc limit 500').fetchall()
                return self.respond(200, [{'key': k, 'request': json.loads(q), 'response': json.loads(r)} for k, q, r in rows])
        self.respond(404, {'message': 'recurso no encontrado'})

    def do_PUT(self):
        self.do_POST()

    def do_POST(self):
        expected = self.headers.get('X-Expected-Provider')
        if expected and expected.lower() != PROVIDER:
            return self.respond(409, {'message': 'identidad de proveedor incorrecta'})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or '{}')
        except (ValueError, TypeError):
            return self.respond(400, {'message': 'JSON inválido'})
        with db() as con:
            if self.path == '/admin/mode':
                mode = body.get('mode')
                if mode not in ['NORMAL', 'SLOW', 'DOWN', 'REJECT']:
                    return self.respond(400, {'message': 'modo inválido'})
                con.execute("insert into settings values ('mode', ?) on conflict(key) do update set value=excluded.value", (mode,))
                con.commit()
                return self.respond(200, {'mode': mode})
            if self.path == '/history' and PROVIDER == 'erp':
                row = con.execute("select value from settings where key='mode'").fetchone()
                if row and row[0] != 'NORMAL': return self.respond(503, {'message': 'ERP no disponible'})
                history = body.get('history', {})
                keys = ['deliveredOrders', 'latePayments', 'overduePayments', 'returns', 'confirmedIncidents', 'declinedPayments']
                if not body.get('customer') or any(type(history.get(k)) is not int or history[k] < 0 for k in keys) or not isinstance(history.get('purchasedAmount'), (int, float)) or history['purchasedAmount'] < 0:
                    return self.respond(400, {'message': 'historial ERP inválido'})
                con.execute('insert into customer_history values (?,?) on conflict(customer) do update set history=excluded.history', (body['customer'], json.dumps(history)))
                con.commit()
                return self.respond(200, {'accepted': True})
            if self.path == '/tracking' and PROVIDER == 'logiexpress':
                row = con.execute("select value from settings where key='mode'").fetchone()
                if row and row[0] != 'NORMAL':
                    return self.respond(503, {'message': 'transportista no disponible'})
                try:
                    request = urllib.request.Request(os.environ.get('COMMERCE_URL', 'http://backend:8080') + '/api/providers/logiexpress/tracking', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'X-Provider-Key': os.environ.get('CARRIER_WEBHOOK_KEY', 'sgologic-local-carrier-key')}, method='POST')
                    with urllib.request.urlopen(request, timeout=5) as response:
                        return self.respond(200, json.loads(response.read()))
                except urllib.error.HTTPError as error:
                    return self.respond(error.code, {'message': 'actualización de rastreo rechazada'})
                except (OSError, ValueError):
                    return self.respond(503, {'message': 'no se pudo transmitir el rastreo'})
            if self.path != '/execute':
                return self.respond(404, {'message': 'recurso no encontrado'})
            key = self.headers.get('Idempotency-Key')
            if not key:
                return self.respond(400, {'message': 'falta Idempotency-Key'})
            previous = con.execute('select response from records where key=?', (key,)).fetchone()
            if previous:
                cached = json.loads(previous[0])
                if cached.get('approved', True) and cached.get('accepted', True) and not cached.get('rejection'):
                    return self.respond(200, cached)
            row = con.execute("select value from settings where key='mode'").fetchone()
            mode = row[0] if row else 'NORMAL'
            if mode == 'DOWN':
                return self.respond(503, {'message': PROVIDER + ' no disponible'})
            if mode == 'SLOW':
                time.sleep(6)
                return self.respond(504, {'message': PROVIDER + ' excedió el tiempo de espera'})
            reject = mode == 'REJECT'
            ref = PROVIDER.upper() + '-' + hashlib.sha256(key.encode()).hexdigest()[:16].upper()
            if PROVIDER == 'payklik':
                result = {'approved': not reject, 'providerReference': ref, 'failureReason': 'fondos insuficientes' if reject else None, 'latencyMs': 80}
            elif PROVIDER == 'sat':
                result = {'accepted': not reject, 'message': 'documento rechazado: serie no autorizada' if reject else 'documento aceptado, autorización ' + body['cui']}
            elif PROVIDER == 'logiexpress':
                if reject:
                    return self.respond(422, {'message': 'dirección fuera de cobertura'})
                result = {'trackingNumber': ref, 'latencyMs': 80}
            elif PROVIDER == 'messaging':
                result = {'rejection': 'destinatario rechazado' if reject else None}
            else:
                if reject:
                    return self.respond(422, {'message': PROVIDER + ' rechazó el documento'})
                result = {'accepted': True, 'reference': ref}
                if PROVIDER == 'erp':
                    name = body.get('fileName', '')
                    if Path(name).name != name or not name.endswith(('.csv', '.xml')):
                        return self.respond(400, {'message': 'nombre de archivo inválido'})
                    (DATA / name).write_text(body['content'], encoding='utf-8')
            # Serialize idempotency commits, including simultaneous calls for the same key.
            con.execute("""insert into records values (?, ?, ?) on conflict(key) do update set response=excluded.response
                        where json_extract(records.response,'$.approved')=0 or json_extract(records.response,'$.accepted')=0
                        or json_extract(records.response,'$.rejection') is not null""", (key, json.dumps(body), json.dumps(result)))
            persisted = con.execute('select response from records where key=?', (key,)).fetchone()
            con.commit()  # A successful HTTP response must follow the durable idempotency commit.
            self.respond(200, json.loads(persisted[0]))


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8090), Handler).serve_forever()
