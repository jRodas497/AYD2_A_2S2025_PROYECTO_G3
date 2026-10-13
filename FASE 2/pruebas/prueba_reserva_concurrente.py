#!/usr/bin/env python3
"""Prueba de concurrencia de la reserva de stock (RF04, RC08): muchos clientes intentan comprar
al mismo tiempo más unidades de las que existen, y se comprueba que no hay sobreventa.

Qué hace:
1. Toma clientes que no tengan carrito abierto y le agrega a cada uno el mismo producto con una
   cantidad grande, de modo que la demanda total supere varias veces la existencia.
2. Dispara todos los checkouts a la vez.
3. Verifica en la base, no en la respuesta del API:
   - lo reservado para las órdenes creadas es exactamente éxitos × cantidad;
   - ninguna ubicación quedó con más reservado que existencia;
   - ningún checkout rechazado dejó una orden o una reserva a medias.

Necesita Docker (lee la base con el rol de solo aplicación). Uso:

    python3 prueba_reserva_concurrente.py
    python3 prueba_reserva_concurrente.py --producto 5 --cantidad 60 --clientes 80
"""
import argparse
import json
import os
import subprocess
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor


TOKEN = None

def sql(consulta):
    salida = subprocess.run(
        ["docker", "exec", "-e", "PGPASSWORD=" + os.environ.get("DB_APP_PASSWORD", "sgologic_app_dev"), os.environ.get("SGO_DB_CONTAINER", "sgologic-db"),
         "psql", "-h", "127.0.0.1", "-U", "sgologic_app", "-d", "sgologic", "-tAc", consulta],
        capture_output=True, text=True, check=True)
    return salida.stdout.strip()


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
    ap.add_argument("--producto", type=int, help="por defecto, el de mayor existencia")
    ap.add_argument("--cantidad", type=int, help="por defecto, lo necesario para que solo quepan pocas órdenes")
    ap.add_argument("--clientes", type=int, default=80)
    ap.add_argument("--reponer", type=int, default=200,
                    help="unidades que se reponen en CD-01 antes de la prueba (0 para no reponer)")
    a = ap.parse_args()
    B = a.base
    global TOKEN
    TOKEN = http("POST", B + "/api/auth/login", {"username":"admin","password":"admin123"})[1]["token"]

    # Por defecto: el producto con más existencia, y una cantidad tal que la ubicación más surtida
    # solo alcance para unas 10 órdenes. Así todas las peticiones pelean por las mismas pocas filas.
    if a.producto is None:
        a.producto = max(range(1, 13), key=lambda p: (http(
            "GET", f"{B}/api/inventory/products/{p}/availability")[1]["totalAvailable"], -p))
    # Fixture: una reposición conocida en CD-01, registrada como movimiento de entrada igual que
    # haría una bodega. Sin esto, la prueba depende de cuánto stock dejaron las pruebas anteriores.
    if a.reponer > 0:
        sql("update inventory.stock set on_hand = on_hand + %d, updated_at = now() "
            "where product_id = %d and location_id = (select id from inventory.location where code = 'CD-01')"
            % (a.reponer, a.producto))
        sql("insert into inventory.stock_movement (location_id, product_id, type_id, quantity, reason) "
            "select id, %d, 1, %d, 'Reposición para prueba de concurrencia' from inventory.location where code = 'CD-01'"
            % (a.producto, a.reponer))
    por_ubicacion = [l["available"] for l in http(
        "GET", f"{B}/api/inventory/products/{a.producto}/availability")[1]["byLocation"]]
    if a.cantidad is None:
        a.cantidad = max(1, max(por_ubicacion) // 10 + 1)

    # Clientes sin carrito activo, para que el checkout solo lleve el producto de la prueba.
    libres = [int(x) for x in sql(
        "select c.id from customers.customer c where c.active and not exists (select 1 from orders.cart k "
        "where k.customer_id = c.id and k.status_id in (1,2)) order by c.id desc limit %d" % a.clientes).split()]

    disponible_antes = http("GET", f"{B}/api/inventory/products/{a.producto}/availability")[1]["totalAvailable"]
    if len(libres) != a.clientes or len(libres) * a.cantidad <= disponible_antes:
        raise RuntimeError("La fixture debe incluir todos los clientes solicitados y demanda superior al stock")
    for c in libres:
        http("POST", f"{B}/api/customers/{c}/cart/items",
             {"productId": a.producto, "quantity": a.cantidad, "channel": "WEB"})
    max_orden_antes = int(sql("select coalesce(max(id),0) from orders.purchase_order"))

    print(f"Producto {a.producto}: {disponible_antes} unidades disponibles.")
    print(f"{len(libres)} clientes piden {a.cantidad} c/u a la vez = {len(libres) * a.cantidad} unidades.\n")

    inicio = time.perf_counter()
    with ThreadPoolExecutor(max_workers=len(libres)) as pool:
        respuestas = list(pool.map(
            lambda c: http("POST", f"{B}/api/orders/checkout", {"customerId": c, "deliveryAddress": "Prueba"}),
            libres))
    duracion = time.perf_counter() - inicio

    exitos = [r for s, r in respuestas if s == 201]
    rechazos = [r for s, r in respuestas if s == 409]
    otros = [(s, r) for s, r in respuestas if s not in (201, 409)]
    ids = [r["id"] for r in exitos] or [0]

    reservado = int(sql(
        "select coalesce(sum(quantity),0) from inventory.reservation where product_id = %d and order_id in (%s)"
        % (a.producto, ",".join(map(str, ids)))))
    sobreventa = int(sql("select count(*) from inventory.stock where reserved > on_hand"))
    ordenes_nuevas = int(sql(
        "select count(*) from orders.purchase_order where id > %d and customer_id in (%s)"
        % (max_orden_antes, ",".join(map(str, libres)))))
    huerfanas = int(sql(
        "select count(*) from orders.purchase_order o where o.id > %d and o.customer_id in (%s) "
        "and not exists (select 1 from inventory.reservation r where r.order_id = o.id)"
        % (max_orden_antes, ",".join(map(str, libres)))))
    disponible_despues = http("GET", f"{B}/api/inventory/products/{a.producto}/availability")[1]["totalAvailable"]

    checks = [
        ("Hubo aceptaciones y rechazos", f"{len(exitos)} / {len(rechazos)}", bool(exitos) and bool(rechazos)),
        ("Checkouts aceptados (201)", len(exitos), None),
        ("Checkouts rechazados por falta de stock (409)", len(rechazos), None),
        ("Otras respuestas (deberían ser 0)", len(otros), len(otros) == 0),
        ("Unidades reservadas = aceptados × cantidad",
         f"{reservado} = {len(exitos)} × {a.cantidad}", reservado == len(exitos) * a.cantidad),
        ("Órdenes creadas = checkouts aceptados", f"{ordenes_nuevas} = {len(exitos)}", ordenes_nuevas == len(exitos)),
        ("Órdenes sin reserva (a medias)", huerfanas, huerfanas == 0),
        ("Ubicaciones con reservado > existencia", sobreventa, sobreventa == 0),
        ("Reservado no supera lo que había", f"{reservado} ≤ {disponible_antes}", reservado <= disponible_antes),
    ]
    print(f"Duración de la ráfaga: {duracion:.2f} s · disponible después: {disponible_despues}\n")
    print("| Verificación | Resultado | OK |")
    print("|---|---|---|")
    for nombre, valor, ok in checks:
        print(f"| {nombre} | {valor} | {'' if ok is None else ('Sí' if ok else 'NO')} |")
    # Limpieza: los carritos que no se convirtieron en orden se borran para no dejar basura.
    sql("delete from orders.cart where status_id in (1,2) and customer_id in (%s)" % ",".join(map(str, libres)))
    for order in exitos:
        status,_ = http("POST", f"{B}/api/orders/{order['id']}/cancel", {})
        assert status==200, status

    success=all(ok for _, _, ok in checks if ok is not None)
    print("\nSIN SOBREVENTA" if success else "\nFALLÓ")
    if not success: raise SystemExit(1)


if __name__ == "__main__":
    main()
