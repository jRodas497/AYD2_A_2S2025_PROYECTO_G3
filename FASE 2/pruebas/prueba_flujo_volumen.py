#!/usr/bin/env python3
"""Camino feliz del enunciado con volumen: muchos clientes compran a la vez y cada orden tiene
que llegar sola hasta el despacho con guía de LogiExpress.

Por cada cliente, en paralelo: agrega un producto al carrito (canales alternados), hace checkout
y paga. Después espera a que el outbox lleve cada orden por facturación, despacho y guía, y
revisa en qué estado quedó cada una.

Uso:
    python3 prueba_flujo_volumen.py                # 60 clientes
    python3 prueba_flujo_volumen.py --clientes 100
"""
import argparse
import json
import os
import subprocess
import time
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

CANALES = ["WEB", "MOBILE", "CALL_CENTER"]


TOKEN = None

def sql(consulta):
    return subprocess.run(
        ["docker", "exec", "-e", "PGPASSWORD=" + os.environ.get("DB_APP_PASSWORD", "sgologic_app_dev"), "sgologic-db",
         "psql", "-h", "127.0.0.1", "-U", "sgologic_app", "-d", "sgologic", "-tAc", consulta],
        capture_output=True, text=True, check=True).stdout.strip()


def http(metodo, url, cuerpo=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(url, data=datos, method=metodo, headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + TOKEN} if TOKEN else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8080")
    ap.add_argument("--clientes", type=int, default=60)
    ap.add_argument("--producto", type=int, default=7)
    ap.add_argument("--espera", type=int, default=90, help="segundos máximos esperando al outbox")
    a = ap.parse_args()
    B = a.base
    global TOKEN
    TOKEN = http("POST", B + "/api/auth/login", {"username":"admin","password":"admin123"})[1]["token"]

    # Fixture: existencia suficiente para que ninguna orden falle por stock (esto prueba el flujo,
    # no la sobreventa; esa la cubre prueba_reserva_concurrente.py).
    sql("update inventory.stock set on_hand = on_hand + %d where product_id = %d and location_id = "
        "(select id from inventory.location where code = 'CD-02')" % (a.clientes, a.producto))
    sql("insert into inventory.stock_movement (location_id, product_id, type_id, quantity, reason) "
        "select id, %d, 1, %d, 'Reposición para prueba de volumen' from inventory.location where code = 'CD-02'"
        % (a.producto, a.clientes))

    clientes = [int(x) for x in sql(
        "select c.id from customers.customer c where not exists (select 1 from orders.cart k "
        "where k.customer_id = c.id and k.status_id in (1,2)) order by c.id limit %d" % a.clientes).split()]

    def comprar(i_cliente):
        i, cliente = i_cliente
        canal = CANALES[i % 3]
        http("POST", f"{B}/api/customers/{cliente}/cart/items",
             {"productId": a.producto, "quantity": 1, "channel": canal})
        s, orden = http("POST", f"{B}/api/orders/checkout", {"customerId": cliente, "deliveryAddress": "Zona 1"})
        if s != 201:
            return None, f"checkout {s}"
        s, pago = http("POST", f"{B}/api/orders/{orden['id']}/payments",
                       {"method": "CARD", "cardToken": "tok_volumen", "cardLast4": "4242"})
        return orden["id"], pago.get("result", f"pago {s}")

    inicio = time.perf_counter()
    with ThreadPoolExecutor(max_workers=len(clientes)) as pool:
        resultados = list(pool.map(comprar, enumerate(clientes)))
    compra = time.perf_counter() - inicio
    ids = [oid for oid, _ in resultados if oid]
    print(f"{len(clientes)} clientes compraron a la vez en {compra:.2f} s "
          f"(resultados del cobro: {dict(Counter(r for _, r in resultados))})")

    # Esperar a que facturación, despacho y guía ocurran solos.
    limite = time.time() + a.espera
    while True:
        estados = {oid: http("GET", f"{B}/api/orders/{oid}")[1] for oid in ids}
        listas = [e for e in estados.values() if e.get("trackingNumber")]
        if len(listas) == len(ids) or time.time() > limite:
            break
        time.sleep(3)
    total = time.perf_counter() - inicio

    print(f"\nTras {total:.1f} s desde la primera compra:\n")
    print("| Estado de la orden | Factura | Envío | Órdenes |")
    print("|---|---|---|---|")
    for (st, fac, env), n in Counter(
            (e["status"], e["invoiceStatus"], e["shipmentStatus"]) for e in estados.values()).most_common():
        print(f"| {st} | {fac} | {env} | {n} |")
    canales = Counter(e["channel"] for e in estados.values())
    print(f"\nCanales: {dict(canales)}")
    print(f"Con guía de LogiExpress: {len(listas)} de {len(ids)}")
    success=len(listas) == len(ids) == len(clientes)
    print("\nFLUJO COMPLETO" if success else
          "\nALGUNAS ÓRDENES NO LLEGARON A GUÍA (ver /api/shipments?status=GUIDE_REQUESTED: "
          "consultar estado/error de eventos Kafka)")

    if not success: raise SystemExit(1)

if __name__ == "__main__":
    main()
