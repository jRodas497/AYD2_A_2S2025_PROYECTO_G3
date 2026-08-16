# Justificación de Decisiones Arquitectónicas

> Síntesis narrativa de los 5 ADR (`Docs/ADR/0001` a `0005`) para uso directo en la defensa oral. Cada ADR individual tiene el detalle completo (alternativas, consecuencias); este documento conecta las decisiones entre sí y con los stakeholders/drivers que las motivan. Borrador de trabajo — el equipo debe poder explicar cada párrafo sin leerlo.

## De dónde parte cada decisión

Ninguna decisión se tomó desde una preferencia tecnológica. Todas responden a un driver priorizado en `Docs/DDA/03-caracteristicas-priorizadas.md`:

| Decisión | Driver(s) que la origina | Stakeholder que más la exige |
|---|---|---|
| ADR-0001 — Estilo arquitectónico | DC-01, DC-02, DC-05, DC-06, DC-09, DC-10 | Carlos Méndez (mantenibilidad, continuidad) |
| ADR-0002 — Resiliencia de pagos | DC-01, DC-02, DC-06, DC-07, DC-08 | Jefe de Operaciones (incidente $150K), Ana Lucía Fuentes (auditabilidad) |
| ADR-0003 — Integración batch ERP | DC-05, DC-07, DR-04 | Junta Directiva (no tocar ERP-Core), Ana Lucía Fuentes |
| ADR-0004 — Tolerancia a fallas de terceros | DC-06, DC-11 | Roberto Quezada (errores de despacho) |
| ADR-0005 — Despliegue on-prem → nube | DC-02, DC-09, DC-10, DR-09, DR-10, DR-11 | Junta Directiva (decisión on-prem), Carlos Méndez (operación) |

## El hilo conductor: por qué estas 5 decisiones son una sola arquitectura, no 5 sueltas

1. **ADR-0001 fija el molde:** un monolito modular con un broker de mensajería como columna vertebral. Esta decisión no es un fin en sí misma — es la que hace *posibles* a las otras 4 sin exceder el presupuesto ($150K / $1,200 mensual) ni las competencias del equipo (Java/.NET/Docker, sin Kubernetes).
2. **ADR-0002, 0003 y 0004 son instancias del mismo patrón** (desacoplar vía el broker, proteger con circuit breaker, nunca bloquear el flujo principal) aplicado a los tres puntos de falla que el caso documenta con cifras concretas: PayKlik (45 min de caída, $150K), LogiExpress (2% de timeouts), y el ERP-Core (ventana fija de 30 min, inmodificable). No son tres soluciones distintas — es la misma estrategia de resiliencia aplicada consistentemente.
3. **ADR-0005 es la salida:** una vez que los componentes ya están desacoplados por el broker (consecuencia de ADR-0001), la migración futura a nube no requiere rediseñar nada — solo reubicar contenedores. Esto es lo que permite prometer "on-premises ahora, nube después" sin que sea una promesa vacía.

## Cómo cada decisión resuelve el driver de mayor prioridad

El driver #1 en `03-caracteristicas-priorizadas.md` es **DC-01 (disponibilidad ante falla de PayKlik, prioridad 20/20)**. La cadena de decisiones que lo resuelve, en orden:

- ADR-0001 decide que exista un broker de mensajería como mecanismo de desacoplamiento general.
- ADR-0002 lo instancia específicamente para pagos: *Transactional Outbox* (la orden se persiste antes de intentar cobrar, nunca se pierde) + *Circuit Breaker* (deja de insistir con PayKlik si está caído) + cola de reintentos asíncronos.
- El diagrama de despliegue (`Docs/Diagramas/despliegue.drawio`) muestra dónde vive físicamente ese mecanismo (Host Docker — Servicios de Integración Externa) y lo anota explícitamente con `DC-01`.
- La matriz de trazabilidad (`Docs/DDA/07-matrices-trazabilidad.md`, tabla 7.2.a) documenta el mecanismo de validación: una prueba de caos que simula la caída de PayKlik y verifica 0 órdenes perdidas.

Esta es la cadena completa que el equipo debe poder recitar ante el comité: **driver → decisión → vista → validación**, sin huecos.

## Qué NO se decidió, y por qué (para anticipar preguntas del comité)

- **No se eligió un segundo proveedor de pagos (multi-PSP).** Resolvería DC-01 de forma más robusta, pero certificar PCI con un segundo gateway y mantenerlo no cabe en el presupuesto ni en el tiempo antes del próximo Black Friday (DR-01, DR-02, DR-03). Se documenta como evolución futura en ADR-0002.
- **No se eligió Kubernetes desde el inicio.** Sería la opción "más correcta" en abstracto para escalabilidad y portabilidad, pero el equipo no tiene esa competencia hoy (DR-09) y el riesgo de no llegar a tiempo a Black Friday supera el beneficio. Se documenta como paso intermedio natural en ADR-0005.
- **No se resolvió DC-03/DC-04 (rendimiento de consulta y auditoría) con un ADR dedicado.** Son requisitos reales, pero se satisfacen con decisiones de implementación (indexado, consulta directa) dentro del estilo ya fijado en ADR-0001 — no representan un tradeoff arquitectónico entre alternativas. Ver la nota completa en `07-matrices-trazabilidad.md` §7.2.a.

## Costos y consecuencias, en una frase por decisión

| Decisión | Costo/consecuencia aceptada |
|---|---|
| ADR-0001 | Consistencia eventual en flujos asíncronos; una base de datos relacional compartida (no una por servicio) |
| ADR-0002 | El cliente puede ver "pago en proceso" unos segundos/minutos durante una falla de PayKlik, en vez de confirmación instantánea |
| ADR-0003 | Los reportes gerenciales nunca son en tiempo real — hasta 30 min de ventana, ya aceptado como límite del ERP-Core |
| ADR-0004 | Una guía de LogiExpress que falla repetidamente requiere intervención humana de Logística |
| ADR-0005 | Sin autoescalado real en la Fase 1 — el pico de Black Friday se cubre con capacidad reservada de antemano, dimensionada con margen |

Ninguna de estas consecuencias es accidental: todas están documentadas y son el precio consciente de cumplir el presupuesto, el plazo y la capacidad real del equipo — el mismo criterio que el enunciado pide defender ante la Alta Gerencia.
