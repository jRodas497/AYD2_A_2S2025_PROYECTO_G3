# ADR-0004: Tolerancia a fallas de terceros (LogiExpress y proveedor de notificaciones)

**Estado:** Propuesta
**Fecha:** 2026-08-13
**Decisores:** Equipo de Arquitectura SGO-Logic (Grupo 3, Sección A) — pendiente de ratificación en reunión de equipo

## Contexto

LogiExpress (logística, contrato vigente 2 años — DR-07) presenta una tasa documentada de ~2% de solicitudes con timeout. El proveedor de notificaciones (SMS, correo, push) tiene disponibilidad fuera del control de MegaStore. El caso es explícito: "una falla en los canales de comunicación no debe impedir que la operación principal continúe". Roberto Quezada (Jefe de Logística) además exige reducir errores de despacho en 70% (DC-11), lo que implica que la integración con LogiExpress debe ser confiable aun cuando el proveedor falle intermitentemente.

## Decisión

Aplicamos **desacoplamiento asíncrono diferenciado por criticidad**, reutilizando el broker de mensajería de ADR-0001:

- **LogiExpress (crítico para el despacho):** las llamadas pasan por un *circuit breaker* con reintento y *dead-letter queue*; una guía que no puede generarse tras los reintentos configurados genera una alerta operativa para Logística, pero **no bloquea** la confirmación de la orden ni el resto del flujo.
- **Notificaciones (no crítico):** se procesan en modo *fire-and-forget* a través de una cola dedicada; un fallo del proveedor de notificaciones se registra pero nunca reintenta bloqueando otro flujo, y nunca impide confirmar, pagar, facturar o despachar una orden.

Ambos adaptadores exponen métricas (tasa de éxito/fallo, profundidad de cola) para el monitoreo continuo que exige Carlos Méndez.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Llamadas síncronas directas sin protección | Simple | Un timeout de LogiExpress (2% de los casos) bloquearía la confirmación de la orden; una caída del proveedor de notificaciones bloquearía todo el flujo | Viola explícitamente DC-06 y el requisito textual del caso |
| Mismo tratamiento (crítico) para LogiExpress y notificaciones | Diseño más uniforme y simple | Trata como igualmente crítico algo que el negocio no considera igual (una guía de despacho sí importa operativamente; una notificación no debe bloquear nada) | No refleja la prioridad real de negocio; sobre-ingeniería para notificaciones |
| Desacoplamiento diferenciado por criticidad (elegido) | Cada integración recibe el nivel de resiliencia que su impacto de negocio justifica; reutiliza el broker ya decidido, sin componentes de infraestructura nuevos | Requiere definir y documentar claramente qué es "crítico" vs "best-effort" para no ser ambiguo en el diseño | Es el balance más ajustado a la evidencia del caso |

## Consecuencias

**Positivas:**
- Ninguna falla de un proveedor externo secundario detiene la operación principal (cumple el requisito textual del caso).
- Las alertas de LogiExpress permiten a Logística intervenir manualmente cuando sea necesario, apoyando el objetivo de -70% de errores de despacho.

**Negativas / tradeoffs aceptados:**
- Una guía de LogiExpress que falla repetidamente requiere intervención humana — no es 100% automático; se acepta porque el proveedor no puede reemplazarse (DR-07).
- El cliente podría no recibir una notificación puntual si el proveedor externo falla; se documenta como riesgo aceptado y comunicado.

## Drivers que atiende

- DC-06, DC-11
- DR-07

## Vistas afectadas

- `Docs/Diagramas/componentes.drawio`
- `Docs/Diagramas/despliegue.drawio`
