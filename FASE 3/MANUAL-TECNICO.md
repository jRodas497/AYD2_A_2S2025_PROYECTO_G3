# Manual técnico del testeo

## Requisitos

Docker Engine/Desktop con contenedores Linux y Compose v2, Python 3.10 o posterior y Node.js 22 o posterior. Docker debe poder descargar las imágenes PostgreSQL 16, Kafka 3.8.1, Maven/Java 21, Node y nginx. La instalación de npm y Chromium requiere red en la primera ejecución. Las pruebas no requieren credenciales de nube.

El proyecto conserva Java 21/Spring Boot del backend y React/TypeScript/Vite del frontend. Python utiliza exclusivamente biblioteca estándar. No hay un segundo backend ni una segunda implementación de las reglas de crédito.

## Ejecución completa

```text
python "FASE 3/verificar.py"
```

El comando funciona desde cualquier directorio si se indica la ruta correcta al script. Resuelve todos los demás paths a partir de su ubicación.

Secuencia: verificación de Docker, unitarias/backend y compilación en Maven dentro de Docker, `npm ci`, unitarias/frontend, lint, build, instalación del navegador, stack y migraciones, integración de crédito, regresiones de Fase 2, cinco cargas, cinco estrés, concurrencia de stock, volumen de ventas, rendimiento, caídas reales, E2E y comprobación de reportes. Los timeouts de las etapas evitan esperas indefinidas; los sondeos de estados asíncronos tienen plazos específicos.

El runner detiene la aceptación en la primera etapa fallida, pero guarda logs, estado y resumen en `finally`. Las pruebas posteriores no ejecutadas no se presentan como aprobadas. La preparación de Maven usa `clean verify` y `npm ci` para no aceptar resultados de una compilación anterior.

## Entorno de prueba

`verificar.py` resuelve `FASE 2/docker-compose.yml` con `docker compose config --format json`, aplicando `test.env`. Retira nombres de contenedor fijos y crea nombres de red/volumen basados en fecha UTC e identificador único. PostgreSQL no publica un puerto en el host. El backend usa 18080 y el frontend 18081 en loopback. No se debe iniciar otro flujo simultáneamente sobre esos mismos puertos.

`compose.json` en el directorio de resultados contiene la topología exacta de esa corrida. Sus credenciales son exclusivamente de prueba. Los scripts anteriores reciben `QA_COMPOSE_FILE`, `COMPOSE_PROJECT_NAME`, `SGO_DB_CONTAINER` y `SGO_URL`; mantienen su comportamiento previo cuando no se definen esas variables.

El proveedor ERP recibe historiales mediante su API real y el backend refresca una proyección PostgreSQL. Para probar un historial vencido se actualiza únicamente la fecha de la fixture dentro de la base de prueba. Las pruebas crediticias observan el resultado de la API, las decisiones guardadas, la deuda y los avisos, además del pipeline de factura y despacho.

Los tokens simulados se generan a partir de un UUID, reemplazando cada dígito por una letra distinta. Se conserva la unicidad y la entropía del identificador. Esto evita que un token aleatorio forme por casualidad una secuencia de 13–19 dígitos válida por Luhn y sea rechazado como PAN. La protección de backend y PostgreSQL permanece activa; la regresión reproduce esa entrada deliberadamente.

## Ejecutar categorías durante desarrollo

```text
python "FASE 3/verificar.py" --suite integracion
python "FASE 3/verificar.py" --suite capacidad
python "FASE 3/verificar.py" --suite e2e
```

Estas variantes preparan un stack nuevo y producen `complete_acceptance=false`, incluso cuando pasan. Se deben usar para investigar un escenario; la entrega requiere ejecutar el comando completo.

Para inspeccionar una corrida sin borrar su entorno:

```text
python "FASE 3/verificar.py" --keep-stack
```

El resumen identifica el proyecto. Para ejecutar un comando contra ese entorno, copiar la ruta a `compose.json` y el valor `project` de `resumen.json`:

```text
docker compose -f "RUTA/compose.json" -p NOMBRE_PROYECTO ps --all
docker compose -f "RUTA/compose.json" -p NOMBRE_PROYECTO logs backend
docker compose -f "RUTA/compose.json" -p NOMBRE_PROYECTO down --volumes
```

Ese último comando elimina exclusivamente los datos temporales de la corrida indicada. El caché Maven `fase3qa-m2` se reutiliza y no contiene datos de la aplicación.

## Interpretación de los artefactos

| Archivo | Contenido |
|---|---|
| `resumen.json` | Resultado, alcance, fechas, duración/código por etapa, conteos y hashes |
| `integracion.xml`, `carga.xml`, `estres.xml` | Un caso JUnit por método ejecutado y error completo al fallar |
| `carga.json`, `estres.json` | Solicitudes, concurrencia, distribución de resultados, p50/p95/p99/máximo, throughput y recursos |
| `rendimiento.json` | SLAs de consulta de estado, cobros y auditoría del script anterior |
| `junit-backend/` | Reportes Surefire de todos los tests Java |
| `unitarias-frontend.xml` | Casos Vitest |
| `e2e.xml`, `playwright-report/` | Casos y reporte navegable de Chromium |
| `*.log` | Salida de cada etapa; logs y estado del stack al terminar |

Playwright conserva capturas, video y traza de fallos en `FASE 2/frontend/test-results/`. El HTML incluye enlaces a las evidencias correspondientes. En CI ambas carpetas se publican como artefacto `fase3-pruebas` con retención de 14 días.

## Integración continua

El job de testeo `e2e` de `.github/workflows/ci.yml` llama al mismo comando completo después de los jobs existentes de backend y frontend. El flujo de pruebas no llama APIs de despliegue. Los pasos de publicación de evidencia se ejecutan con `always()`. Un fallo propagado por Python falla el job que ya es dependencia del flujo existente. No se modificó la implementación del job de despliegue.

Para evitar ocultar fallos intermitentes, el comando de aceptación usa `--retries=0`. No se usan `skip`, `only` o tolerancias de errores para cumplir el mínimo.

## Diagnóstico

- **Docker no disponible:** iniciar el daemon y verificar `docker version`; el runner falla antes de modificar la aplicación.
- **Puerto ocupado:** detener la otra corrida de QA o el proceso que usa 18080/18081. Ver `stack.log` y `estado-stack.log`.
- **Migración rechazada por Linux:** `.gitattributes` exige LF para `*.sh`; `migrate.sh` está normalizado. Una copia externa con CRLF requiere restaurar LF.
- **Timeout de proveedor:** identificar modo y evento en el log; los tests restauran `NORMAL` y sondean el estado durable, no usan esperas arbitrarias para asumir éxito.
- **SLA incumplido:** examinar percentiles, recursos y concurrencia; reproducir con `--suite capacidad`. Documentar hardware y hallazgo, corregir el problema y repetir la aceptación completa.
- **Selector UI fallido:** abrir reporte/traza y comparar el contrato de la pantalla con el estado backend. Evitar sustituirlo por un selector ambiguo o un resultado simulado.

## Referencias de herramientas

Se emplean APIs públicas de [JUnit 5](https://junit.org/junit5/docs/current/user-guide/), [unittest de Python](https://docs.python.org/3/library/unittest.html), [reportes de Vitest](https://vitest.dev/guide/reporters.html), [reportes de Playwright](https://playwright.dev/docs/test-reporters) y [configuración de Docker Compose](https://docs.docker.com/reference/cli/docker/compose/config/). Las bibliotecas son dependencias del proyecto; los casos se diseñaron a partir de sus contratos y del enunciado.
