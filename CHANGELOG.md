# Cambios por versión

Cada versión corresponde a un tag en `main`. El detalle día por día está en la [bitácora](BITACORA.md).

## v1 — Fase 3: crédito propio, despliegue continuo y pruebas

Respecto a `v0.1-fase1`:

- **Crédito propio «Compra ahora, paga en 30 días».** Evaluación en el checkout con criterios configurables, historial del ERP en una proyección local, decisiones auditadas, cargos con vencimiento y abonos con PayKlik. PayKlik sigue siendo la ruta de respaldo. Decisión en [ADR-0010](FASE%203/DDA/ADR/0010-evaluacion-de-credito-propio.md).
- **Integraciones.** Kafka y seis proveedores externos simulados, devoluciones y conciliación con el ERP, permisos por rol, venta asistida, retiro en tienda, ubicaciones, traslados y transporte alternativo (migraciones V10 a V21).
- **Cuentas de cliente.** Registro e inicio de sesión reales, con perfil, notificaciones y recuperación de cuenta.
- **CI/CD y nube.** GitHub Actions con build, pruebas y deploy; el deploy no corre si las pruebas fallan, aplica las migraciones pendientes y espera a que el backend responda. Render, Neon y Cloudflare R2. Decisión en [ADR-0011](FASE%203/DDA/ADR/0011-cicd-y-despliegue-en-la-nube.md).
- **Pruebas.** Verificación automática con `python "FASE 3/verificar.py"`: 242 casos en las cinco categorías (unitarias, integración, E2E, carga y estrés), con evidencia en [FASE 3/EVIDENCIA.md](FASE%203/EVIDENCIA.md).
- **Documentación.** Manual técnico y manual de usuario en `FASE 3/DOCUMENTACION/`, y la arquitectura de la fase en `FASE 3/DDA/`.

## v0.1-fase1 — Definición de arquitectura

Entrega de la Fase 1: DDA, ADR 0001 a 0005, diagramas y prototipo.
