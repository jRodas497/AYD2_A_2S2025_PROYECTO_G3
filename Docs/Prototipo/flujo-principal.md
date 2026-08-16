# Prototipo Arquitectónico — Flujo Principal

Entregable 4: mockups/prototipo de **alto nivel, no funcional**. Los mockups (imágenes/exports de Figma o similar) van en `Docs/Prototipo/mockups/`.

## Flujo principal propuesto (a validar con el equipo)

1. Cliente inicia compra en un canal (web/app/tienda/call center).
2. Sistema verifica disponibilidad y reserva inventario (evita doble compromiso).
3. Cliente elige método de pago; SGO-Logic registra el intento de cobro (orden, canal, fecha, resultado).
4. Confirmación de pago → emisión de factura electrónica a SAT (CUI, serie autorizada) antes de finalizar la orden.
5. Orden confirmada → se determina método de despacho (CD, tienda, o pickup); puede cambiar después de confirmada.
6. Logística recibe la orden a preparar; POS/CD reciben eventos con reintentos.
7. Cliente recibe notificaciones (confirmación, preparación, tránsito, entrega) — best-effort, no bloqueante.
8. Cliente/agente puede consultar estado de la orden en cualquier momento (< 5s) desde cualquier canal.
9. Sincronización batch con ERP-Core cada 30 min.
10. En caso de devolución: se vincula a la venta original y se reconstruye el historial completo para auditoría.

## Pantallas/mockups (no funcionales)

Wireframes HTML estáticos — abrir directo en el navegador, sin dependencias. Son **borrador de trabajo**: sirven para la defensa oral y como base si el equipo prefiere rehacerlos en Figma/otra herramienta.

- [x] [Carrito unificado](mockups/01-carrito-unificado.html) — mismo estado visible en cualquier canal (CDU-01)
- [x] [Checkout](mockups/02-checkout.html) — método de entrega, método de pago, registro de intento de cobro (CDU-02, CDU-04)
- [x] [Estado de orden](mockups/03-estado-orden.html) — vista consolidada para cliente y centro de atención (CDU-06)
- [x] [Vista de logística](mockups/04-logistica.html) — qué preparar, desde dónde, para quién (CDU-04, CDU-08)
- [x] [Vista de finanzas/auditoría](mockups/05-auditoria.html) — historial de una transacción, cumplimiento de datos de pago (CDU-03, CDU-05)

_(Cada mockup referencia en pantalla el CDU y los DC-NN que justifica — ver `Docs/DDA/04-drivers-funcionales.md`.)_
