# Prototipo Arquitectónico

Entregable 4: mockups de alto nivel **no funcionales** y flujo principal del sistema.

Punto de entrada: **[`mockups/index.html`](mockups/index.html)**. Se abren directo en el navegador, sin dependencias externas.

## Flujo principal

Versión navegable: **[`mockups/flujo-principal.html`](mockups/flujo-principal.html)**.

1. El cliente inicia la compra desde cualquier canal y recupera su carrito.
2. Se verifica disponibilidad y se aparta el inventario; la reserva vence a los 20 minutos.
3. El cliente elige entrega y pago; el intento de cobro se registra antes de llamar a la pasarela.
4. Con el pago confirmado se emite la factura electrónica antes de que la orden avance.
5. Se asigna el punto de despacho: centro de distribución, tienda o recogida.
6. El cliente consulta el estado de su orden desde cualquier canal.
7. Las ventas pasan a contabilidad en lotes de 30 minutos.
8. Una devolución se resuelve ligada a la venta original.

Caminos de degradación representados: pasarela de pago sin respuesta (paso 3) y guía de transporte no generada (paso 5).

## Pantallas

| Pantalla | Caso de uso |
|---|---|
| [Carrito](mockups/01-carrito-unificado.html) | CDU-01 |
| [Checkout](mockups/02-checkout.html) | CDU-02, CDU-04 |
| [Pago en proceso](mockups/06-pago-degradado.html) | CDU-02 |
| [Factura](mockups/07-confirmacion-factura.html) | CDU-03 |
| [Estado de orden](mockups/03-estado-orden.html) | CDU-06 |
| [Devolución](mockups/08-devolucion-reembolso.html) | CDU-05 |
| [Logística](mockups/04-logistica.html) | CDU-04 |
| [Inventario](mockups/09-inventario-centralizado.html) | CDU-08 |
| [Conciliación](mockups/10-conciliacion-erp.html) | CDU-07 |
| [Auditoría](mockups/05-auditoria.html) | CDU-03, CDU-05, CDU-07 |
| [Monitoreo](mockups/11-monitoreo-integraciones.html) | — |

Los 8 casos de uso de [`Docs/DDA/04-drivers-funcionales.md`](../DDA/04-drivers-funcionales.md) quedan cubiertos. La pantalla de monitoreo no deriva de un caso de uso: responde a la preocupación de monitoreo del Gerente de TI (ST-01).

Los identificadores de casos de uso y drivers viven en esta tabla, no dentro de los mockups: las pantallas se presentan como las vería un usuario.

## Fuera del prototipo

- **Interfaz del POS de tienda.** Los POS no se modifican ni se reemplazan (DR-04, DR-05); solo reciben eventos.
- **Mantenibilidad (DC-09) y portabilidad a nube (DC-10).** No son observables en una interfaz; viven en el diagrama de despliegue y en ADR-0005.
