# Cambios por versión

Cada versión corresponde a un tag en `main`. El detalle día por día está en la [bitácora](BITACORA.md).

## v2 — Documentación completa de la Fase 3

Respecto a `v1`:

- **Arquitectura de la fase.** [ADR-0012](FASE%203/DDA/ADR/0012-kafka-como-broker-con-el-outbox-como-puente.md) (Kafka como broker, que evoluciona al ADR-0007) y los casos de uso [CDU-09](FASE%203/DDA/casos-de-uso/CDU-09-comprar-a-credito.md) y [CDU-10](FASE%203/DDA/casos-de-uso/CDU-10-abonar-saldo-de-credito.md) del crédito. Los documentos de la Fase 2 que describían el MVP sin Kafka llevan una nota de actualización.
- **Flujos del camino feliz.** Siete flujos con diagramas, capturas y listas de prueba en [FASE 3/FLUJOS](FASE%203/FLUJOS/README.md), con un guion de demostración y un script para habilitar el crédito.
- **Correcciones por feedback.** [Evidencia](FASE%203/CORRECCIONES-POR-FEEDBACK.md) de lo corregido de las fases 1 y 2, con los commits que lo comprueban.
- **Gestión del proyecto.** [Documento de gestión](FASE%203/GESTION-DEL-PROYECTO.md): roles, cronograma, reparto del trabajo, incidentes y retrospectiva.
- **Evidencia de pruebas refrescada.** Nueva corrida completa de `python "FASE 3/verificar.py"`: 242 casos aprobados, con las métricas actualizadas en [EVIDENCIA.md](FASE%203/EVIDENCIA.md).
- **Flujo de trabajo.** [CONTRIBUTING.md](FASE%201/CONTRIBUTING.md) recoge las reglas de la Fase 3: rama `main`, tags `vN`, commits `carnet: mensaje` y cómo se publica una versión.

## v1 — Fase 3: crédito propio, despliegue continuo y pruebas

Respecto a `v0.1-fase1`:

- **Crédito propio «Compra ahora, paga en 30 días».** Evaluación en el checkout con criterios configurables, historial del ERP en una proyección local, decisiones auditadas, cargos con vencimiento y abonos con PayKlik. PayKlik sigue siendo la ruta de respaldo. Decisión en [ADR-0010](FASE%203/DDA/ADR/0010-evaluacion-de-credito-propio.md).
- **Integraciones.** Kafka y seis proveedores externos simulados, devoluciones y conciliación con el ERP, permisos por rol, venta asistida, retiro en tienda, ubicaciones, traslados y transporte alternativo (migraciones V10 a V21).
- **Cuentas de cliente.** Registro e inicio de sesión reales, con perfil, notificaciones y recuperación de cuenta.
- **CI/CD y nube.** GitHub Actions con build y pruebas; Render despliega solo si todos los checks pasan (`autoDeployTrigger: checksPass`). Render, Neon y Cloudflare R2. Decisión en [ADR-0011](FASE%203/DDA/ADR/0011-cicd-y-despliegue-en-la-nube.md).
- **Pruebas.** Verificación automática con `python "FASE 3/verificar.py"`: 242 casos en las cinco categorías (unitarias, integración, E2E, carga y estrés), con evidencia en [FASE 3/EVIDENCIA.md](FASE%203/EVIDENCIA.md).
- **Documentación.** Manual técnico y manual de usuario en `FASE 3/DOCUMENTACION/`, y la arquitectura de la fase en `FASE 3/DDA/`.

## v0.1-fase1 — Definición de arquitectura

Entrega de la Fase 1: DDA, ADR 0001 a 0005, diagramas y prototipo.
