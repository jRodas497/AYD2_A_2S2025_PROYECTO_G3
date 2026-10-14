# Manual de usuario de SGO-Logic

SGO-Logic es la tienda en línea de MegaStore y el panel con el que su personal atiende las órdenes. Este manual explica cómo usar las dos partes: la **tienda**, para clientes, y la **administración**, para el personal.

## Cómo entrar

| Dónde | Dirección |
|---|---|
| Aplicación en la nube | `https://sgologic-frontend.onrender.com` |
| En un equipo local con Docker | `http://localhost:8081` |

La tienda está en la dirección principal y la administración en `/administracion`.

En la nube, si nadie ha entrado en un rato, la primera visita puede tardar hasta un par de minutos y mostrar «Error del servidor (502)». Es el servicio despertando. Espera un minuto y vuelve a intentar.

Para probar sin crear una cuenta hay cuentas de demostración. Todas usan la contraseña `cliente123`:

| Correo | Qué tiene |
|---|---|
| `maria@example.com` | Compradora frecuente, con crédito disponible |
| `lucia@example.com` | La de mayor historial de compras |
| `ana@example.com` | Una devolución registrada |
| `carlos@example.com` | Una compra sin pagar |
| `jorge@example.com` | Cuenta nueva, sin compras |

El personal entra con el usuario de desarrollo `admin` y la contraseña `admin123`, en «Iniciar sesión de personal».

## Para el cliente

### Crear una cuenta e iniciar sesión

1. Abre «Iniciar sesión» en la parte superior.
2. Si no tienes cuenta, pulsa «¿No tienes cuenta? Crear una». Escribe tu nombre, correo y contraseña. El teléfono y la dirección son opcionales y se pueden completar después en «Perfil».
3. Pulsa «Crear cuenta». Quedas con la sesión iniciada.
4. Si olvidaste la contraseña, pulsa «Olvidé mi contraseña» y sigue los pasos para restablecerla.

El catálogo y las promociones se pueden ver sin cuenta. El carrito, el pago, tus órdenes y tu crédito sí piden iniciar sesión.

### Buscar y elegir productos

- **Catálogo.** Muestra los productos con su precio. Pulsa uno para ver el detalle y su disponibilidad.
- **Promociones.** Reúne los productos con descuento vigente. El precio original y el precio con descuento se ven juntos.

En el detalle, elige la cantidad y pulsa para agregar al carrito.

### Carrito

En «Carrito» ves lo que agregaste, con el total. Puedes subir o bajar la cantidad de cada producto y quitarlo. Cuando algo del carrito deja de estar disponible, la pantalla te lo avisa.

Los productos del carrito se reservan por unos 20 minutos mientras terminas la compra. Si no pagas a tiempo, la reserva se libera y otro cliente puede comprarlos.

### Checkout

Pulsa «Checkout» para finalizar:

1. **Entrega.** Escribe la dirección de entrega o elige retiro en tienda y la tienda donde recogerás.
2. **Cómo pagarás.** Siempre aparece «PayKlik · tarjeta y otros medios de pago». Si cumples las condiciones, aparece también «Crédito MegaStore · paga en 30 días». Debajo de las opciones, el sistema te dice por qué el crédito no está disponible cuando no lo está, por ejemplo que necesitas más compras entregadas.
3. Confirma la orden.

### Pagar

Con PayKlik, escribe el número de tarjeta de 16 dígitos y el CVV. En el entorno de prueba, cualquier tarjeta de 16 dígitos, como `4242 4242 4242 4242`, se aprueba. Nunca se guarda el número de tu tarjeta.

Con crédito, no se cobra nada ahora. El sistema evalúa tu historial en ese momento y te avisa si aprobó o rechazó la solicitud. Si la rechaza, puedes continuar la compra con PayKlik.

En los dos casos, la orden termina confirmada o rechazada, y tú recibes un aviso con lo que pasó.

### Seguir tus órdenes

«Mis órdenes» lista tus compras. Al abrir una ves su estado, la dirección, la guía del envío y los avisos hasta la entrega. En «Notificaciones» están todos los mensajes que te envió la tienda. Cuando una orden está pagada, desde el detalle también puedes ver su factura, con su CUI y su serie.

### Mi crédito

«Mi crédito» muestra tu límite, lo usado, lo disponible y el plazo, junto con el historial de solicitudes y los cargos pendientes con su fecha de vencimiento.

El crédito se gana comprando: necesitas varias compras entregadas, sin devoluciones, incidencias ni pagos atrasados o rechazados en tu historial. Los criterios exactos se muestran en la misma pantalla. Si el sistema que guarda tu historial no responde en ese momento, la opción de crédito no aparece y puedes seguir pagando con PayKlik.

Para saldar un cargo, abre «Mi crédito», elige el cargo y paga con tarjeta. El abono confirmado aparece como «Pagado» y libera tu cupo. Si el abono falla, el motivo queda a la vista y puedes reintentarlo.

### Perfil

En «Perfil» actualizas tu nombre, teléfono y dirección.

## Para el personal

Entra en `/administracion` con tu usuario. El menú lateral solo muestra las secciones que tu rol permite. Los roles son administrador, finanzas, logística, agente de call center, encargado de tienda y empleado de tienda.

### Qué se hace en cada sección

| Sección | Para qué sirve |
|---|---|
| Dashboard | Resumen del estado del negocio |
| Órdenes | Buscar y revisar órdenes; abrir una para ver su detalle, pago y trazabilidad |
| Venta asistida | Crear una compra en nombre de un cliente, desde el call center o la tienda |
| Incidencias y Devoluciones | Registrar y resolver problemas, cambios y devoluciones |
| Catálogo y promociones | Crear y editar productos y promociones |
| Ubicaciones y Traslados | Ver tiendas y centros de distribución, y mover mercadería entre ellos |
| Inventario y Reservas | Consultar stock por ubicación, registrar movimientos y ajustes, y ver las reservas activas |
| Logística y Seguimiento | Despachar envíos, asignar transporte y seguir cada entrega |
| Clientes | Buscar clientes y ver su detalle |
| Usuarios y roles | Crear personal y asignarle rol (solo administrador) |
| Auditoría | Consultar quién hizo qué y cuándo |
| Reportes | Reportes de ventas y de pagos |
| ERP y conciliación | Ver los lotes enviados al ERP y los errores |
| Facturas | Consultar las facturas emitidas |
| Configuración | Cambiar los parámetros del sistema, incluidos los del crédito (solo administrador) |
| Integraciones y Notificaciones | Vigilar el estado de los sistemas externos y de los avisos enviados |

### Tareas comunes

**Atender una orden.** En «Órdenes» busca por número, cliente o estado. Abre la orden para ver el pago, la factura, el envío y la traza de auditoría.

**Registrar una incidencia o una devolución.** Abre «Incidencias» o «Devoluciones», elige la orden y registra el motivo. Quien tenga el rol correspondiente la procesa y cambia su estado hasta resolverla. Una devolución en revisión bloquea temporalmente el crédito del cliente.

**Cambiar las reglas del crédito.** En «Configuración» están los parámetros `credit.*`: compras mínimas, importe mínimo, límites de incidencias, devoluciones y pagos atrasados, límite de crédito y plazo. Los cambios aplican a la siguiente compra, sin desplegar nada.

**Mover mercadería.** En «Traslados» se registra un traslado entre dos ubicaciones y en «Logística» se asigna el transporte.

## Problemas frecuentes

| Qué ves | Qué hacer |
|---|---|
| «Error del servidor (502)» en la nube | El servicio estaba dormido; espera un minuto y reintenta |
| «correo o contraseña incorrectos» | Revisa el correo y la contraseña; si no tienes cuenta, créala en «Crear una» |
| Solo aparece PayKlik en el checkout | No cumples todavía las condiciones del crédito; el motivo aparece debajo de las opciones |
| El producto ya no está disponible al pagar | La reserva venció; vuelve a agregarlo al carrito |
| Una orden a crédito fue rechazada | Revisa «Mi crédito» para ver el motivo; puedes continuar con PayKlik |

Para el funcionamiento interno y el despliegue, consulta el [manual técnico](Manual_Tecnico_SGO-Logic.md).
