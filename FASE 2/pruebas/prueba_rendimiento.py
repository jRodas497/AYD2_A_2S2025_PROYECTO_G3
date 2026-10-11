#!/usr/bin/env python3
"""Mide los tiempos de respuesta de las consultas que tienen una meta de rendimiento.

- RC01: estado de la orden, despacho y entrega en menos de 5 segundos.
- RC02: consulta de intentos de cobro (auditoría financiera) en menos de 1 segundo.

Dispara muchas consultas en paralelo contra órdenes al azar y reporta p50, p95, p99 y máximo.
Solo usa la librería estándar. Uso:

    python3 prueba_rendimiento.py                 # valores por defecto
    python3 prueba_rendimiento.py --peticiones 10000 --concurrencia 128
"""
import argparse
import json
import random
import statistics
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor


TOKEN = None

def pedir(url):
    inicio = time.perf_counter()
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={"Authorization":"Bearer " + TOKEN}), timeout=30) as r:
            r.read()
            codigo = r.status
    except urllib.error.HTTPError as e:
        codigo = e.code
    except Exception:
        codigo = 0
    return codigo, (time.perf_counter() - inicio) * 1000


def percentil(valores, p):
    ordenados = sorted(valores)
    return ordenados[min(len(ordenados) - 1, int(round(p / 100 * (len(ordenados) - 1))))]


def escenario(nombre, meta_ms, urls, concurrencia):
    inicio = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrencia) as pool:
        resultados = list(pool.map(pedir, urls))
    duracion = time.perf_counter() - inicio
    tiempos = [t for c, t in resultados if c == 200]
    # Un 404 es un id que no existe (la secuencia deja huecos cuando un checkout se revierte):
    # no es una falla del sistema, se reporta aparte y no cuenta para la métrica.
    inexistentes = sum(1 for c, _ in resultados if c == 404)
    errores = sum(1 for c, _ in resultados if c not in (200, 404))
    r = {
        "escenario": nombre,
        "meta_ms": meta_ms,
        "peticiones": len(urls),
        "concurrencia": concurrencia,
        "errores": errores,
        "ids_inexistentes": inexistentes,
        "por_segundo": round(len(urls) / duracion, 1),
        "p50_ms": round(statistics.median(tiempos), 1),
        "p95_ms": round(percentil(tiempos, 95), 1),
        "p99_ms": round(percentil(tiempos, 99), 1),
        "max_ms": round(max(tiempos), 1),
    }
    r["cumple"] = errores == 0 and r["max_ms"] < meta_ms
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8080")
    ap.add_argument("--peticiones", type=int, default=5000)
    ap.add_argument("--concurrencia", type=int, default=64)
    ap.add_argument("--salida", default="resultados-rendimiento.json")
    a = ap.parse_args()

    global TOKEN
    request=urllib.request.Request(a.base + "/api/auth/login",data=json.dumps({"username":"admin","password":"admin123"}).encode(),headers={"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(request) as response: TOKEN=json.load(response)["token"]
    request=urllib.request.Request(a.base + "/api/orders?limit=500",headers={"Authorization":"Bearer " + TOKEN})
    with urllib.request.urlopen(request) as response: existing=[row["orderId"] for row in json.load(response)]
    if not existing: raise RuntimeError("No hay órdenes para medir; ejecutar prueba_fase2.py primero")
    total=len(existing)
    ids=[random.choice(existing) for _ in range(a.peticiones)]

    escenarios = [
        escenario("RC01 · GET /api/orders/{id} (estado, despacho y entrega)", 5000,
                  [f"{a.base}/api/orders/{i}" for i in ids], a.concurrencia),
        escenario("RC02 · GET /api/reports/payments?orderId={id} (intentos de cobro)", 1000,
                  [f"{a.base}/api/reports/payments?orderId={i}" for i in ids], a.concurrencia),
        escenario("DC-04 · GET /api/orders/{id}/trace (evidencia de auditoría)", 1000,
                  [f"{a.base}/api/orders/{i}/trace" for i in ids], a.concurrencia),
    ]

    print(f"\nÓrdenes en la base: {total} · {a.peticiones} peticiones por escenario · "
          f"concurrencia {a.concurrencia}\n")
    print("| Escenario | Meta | p50 | p95 | p99 | Máx | Req/s | Errores | Cumple |")
    print("|---|---|---|---|---|---|---|---|---|")
    # Tiempos en milisegundos. "Errores" son 5xx o sin respuesta; los ids inexistentes van aparte.
    for r in escenarios:
        print(f"| {r['escenario']} | < {r['meta_ms']} ms | {r['p50_ms']} | {r['p95_ms']} | "
              f"{r['p99_ms']} | {r['max_ms']} | {r['por_segundo']} | {r['errores']} | "
              f"{'Sí' if r['cumple'] else 'NO'} |")
    inexistentes = max(r["ids_inexistentes"] for r in escenarios)
    if inexistentes:
        print(f"\n{inexistentes} de los ids sorteados no existen (huecos de la secuencia); respondieron 404 y no cuentan.")

    with open(a.salida, "w") as f:
        json.dump({"ordenes": total, "escenarios": escenarios}, f, indent=2, ensure_ascii=False)
    print(f"\nDetalle guardado en {a.salida}")
    if not all(r["cumple"] for r in escenarios): raise SystemExit(1)


if __name__ == "__main__":
    main()
