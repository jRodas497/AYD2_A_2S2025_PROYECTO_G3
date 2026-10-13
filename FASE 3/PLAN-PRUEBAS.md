# Plan integral de pruebas

## Objetivo y fundamento

Verificar que la compra omnicanal, pagos, crédito propio, documentos fiscales, inventario, despacho, notificaciones y ERP mantengan sus contratos. El fundamento es el enunciado de Fase 3 (páginas 5–9), los CDU de `FASE 1/Docs/DDA/casos-de-uso/`, `FASE 2/DDA/casos-de-uso-expandidos.md` y los contratos `FASE 2/backend/API*.md`.

Se aplican cinco categorías distintas. Los tests de doble clic en navegador son E2E; la categoría de estrés se satisface adicionalmente mediante sobrecarga HTTP cuantificada e invariantes en PostgreSQL. Las subpruebas de integración y escalones de estrés amplían un caso, sin contarse como categorías adicionales para alcanzar el mínimo.

## Preparación y aislamiento

1. Crear un proyecto Compose de nombre único a partir de la configuración de la fase 2.
2. Usar credenciales públicas de prueba, red y volúmenes propios, sin cargar `.env` de desarrollo o de producción.
3. Iniciar PostgreSQL vacío y aplicar todas las migraciones con `ON_ERROR_STOP`.
4. Iniciar Kafka, backend, frontend y proveedores; esperar healthchecks.
5. Crear clientes, productos y existencias específicas. Restaurar los proveedores a `NORMAL` al finalizar las fallas.
6. Guardar resultados antes de retirar el entorno. El comando de aceptación elimina los volúmenes del proyecto único que creó.

Los escenarios globales de simulación y de navegador corren en serie. La concurrencia se introduce explícitamente dentro de cada escenario. En CI cada trabajo tiene un runner separado; en local se debe ejecutar un flujo a la vez por los puertos 18080 y 18081.

## Categorías y oráculos

| Tipo | Herramienta y aislamiento | Qué se verifica | Evidencia |
|---|---|---|---|
| Unitarias | JUnit 5/Mockito, Vitest/jsdom | Reglas de negocio, errores, traducción de contratos, protección de datos de tarjeta, decisiones de crédito; dependencias sustituidas | Surefire XML y Vitest XML |
| Integración | `unittest`, API real y PostgreSQL/Kafka/proveedores | Interacción ERP/crédito/pagos, autorización, concurrencia, facturación, despacho y notificaciones | `integracion.xml`, logs y regresiones Fase 2 |
| Carga | Python HTTP concurrente, recursos Docker | Demanda esperada de lecturas, decisiones y ventas completas | `carga.xml`, `carga.json` |
| Estrés | Python HTTP concurrente, SQL y registros del proveedor | Demanda 8×, escasez de inventario, contención de checkout/cobro y proveedor lento; recuperación | `estres.xml`, `estres.json` |
| E2E | Chromium/Playwright y aplicación servida por nginx | Navegación, decisiones visibles, compra, crédito, recuperación de cuentas y gestión administrativa | `e2e.xml`, HTML; trazas/capturas/videos de fallos |

## Perfiles de carga

| ID | Perfil | Tamaño/concurrencia | Umbral de aprobación |
|---|---|---|---|
| L01 | Catálogo | 256 solicitudes / 16 clientes | Todas válidas; máximo < 5 s |
| L02 | Estado completo de una orden existente | 256 / 16 | Todas válidas; máximo < 5 s (RC01) |
| L03 | Auditoría financiera de una orden cobrada | 256 / 8 | Todas válidas; máximo < 1 s (RC02) |
| L04 | Elegibilidad de crédito con historial ERP vigente | 256 / 16 | Todas elegibles; máximo < 2 s |
| L05 | Carrito → checkout → pago → factura → guía | 16 ventas / 16 | Cobros < 10 s, 16 órdenes únicas, todas con factura y guía antes de 120 s |

Los umbrales de RC01/RC02 provienen de la arquitectura anterior. Los demás son criterios locales explícitos de aceptación para proveedores simulados, pues el PDF no establece cifras de carga o SLA nuevos. Se registran p50, p95, p99, máximo, tasa de operaciones, operaciones aceptadas y códigos HTTP de rechazos. Una operación de venta agrupa carrito/checkout/pago; su tiempo mide esa secuencia y no un request individual. Una respuesta 404 inesperada cuenta como fallo; se consultan órdenes existentes.

## Perfiles de estrés

| ID | Estímulo extremo | Oráculo y recuperación |
|---|---|---|
| S01 | 1 024 lecturas mixtas por escalón, 16 → 32 → 64 → 128 clientes | Sin errores; máximo < 15 s; catálogo y orden responden después de cada escenario |
| S02 | 80 checkouts compiten por 10 unidades | Exactamente 10 órdenes con reserva y 70 rechazos 409; sin sobreventa ni reservas huérfanas |
| S03 | 32 cobros simultáneos de una sola orden | Una aprobación, un cobro efectivo en PayKlik y una factura; conflictos 409 válidos |
| S04 | 32 checkouts simultáneos del mismo carrito | Una orden completa; rechazo 400/409 de duplicados; reserva consistente |
| S05 | 32 pagos con PayKlik lento | Órdenes pagadas o en proceso, crédito sigue aprobando en < 2 s; todas las ventas progresan tras restaurar el proveedor en < 180 s |

Se muestrean CPU, memoria, red, I/O y procesos con Docker durante los escenarios. Se comprueba que no hubo OOM ni reinicios de contenedores. Tras cada prueba se valida el stock, la disponibilidad y el estado de una orden existente. S01 estudia la degradación hasta 8× la concurrencia normal sin afirmar que ese escalón sea el límite absoluto de capacidad; un cuello de botella o una violación detiene la aprobación.

## Pruebas de fallas y seguridad

La suite adicional de Fase 2 detiene contenedores de Kafka, PayKlik, SAT, LogiExpress, mensajería y POS, observa estados intermedios y exige recuperación. Agota ocho intentos de entrega y verifica replay desde el estado dead-letter. Las regresiones cubren roles, propiedad de recursos, revocación de sesiones, recuperación por correo, devoluciones, cambios, cancelaciones, conciliación ERP y reserva concurrente.

## Criterio de salida

La aprobación requiere: build/lint correctos, todas las etapas con código 0, al menos cinco casos ejecutados por categoría, reportes sin fallos/errores/omisiones, umbrales satisfechos, inventario consistente y recuperación completa. `complete_acceptance=true` solo se produce en una ejecución `--suite all` satisfactoria. Una ejecución parcial no certifica la entrega.

No se altera un umbral para convertir un fallo en éxito: se investiga fixture, contrato, infraestructura y comportamiento. Las correcciones y limitaciones se registran en [EVIDENCIA.md](EVIDENCIA.md). Las pruebas describen una muestra definida, no una demostración matemática de ausencia de todos los bugs ni una medición de disponibilidad anual.
