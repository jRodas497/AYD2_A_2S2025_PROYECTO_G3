# Manual de usuario de SGO-Logic

SGO-Logic es la tienda en línea de MegaStore y el panel con el que su personal atiende las órdenes. Este manual explica cómo usar las dos partes: la **tienda**, para clientes, y la **administración**, para el personal.

Las capturas se tomaron con el sistema completo corriendo en un equipo local y datos de demostración. Los números de orden, los montos y las fechas cambian en cada instalación.

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
| `maria@example.com` | Compradora frecuente |
| `lucia@example.com` | La de mayor historial de compras |
| `ana@example.com` | Una devolución registrada |
| `carlos@example.com` | Una compra sin pagar |
| `jorge@example.com` | Cuenta nueva, sin compras |

El personal entra con el usuario de desarrollo `admin` y la contraseña `admin123`, en «Iniciar sesión de personal».

## Para el cliente

### Crear una cuenta e iniciar sesión

Abre «Iniciar sesión» en la parte superior. Si ya tienes cuenta, escribe tu correo y contraseña y pulsa «Ingresar».

![Pantalla de inicio de sesión del cliente](capturas/01-iniciar-sesion.png)

Si no tienes cuenta, pulsa «¿No tienes cuenta? Crear una». Escribe tu nombre, correo y contraseña. El teléfono y la dirección son opcionales y se pueden completar después en «Perfil». Pulsa «Crear cuenta» y quedas con la sesión iniciada.

![Formulario para crear una cuenta](capturas/02-crear-cuenta.png)

Si olvidaste la contraseña, pulsa «Olvidé mi contraseña» y sigue los pasos para restablecerla.

El catálogo y las promociones se pueden ver sin cuenta. El carrito, el pago, tus órdenes y tu crédito sí piden iniciar sesión.

### Buscar y elegir productos

«Catálogo» muestra los productos con su precio. Pulsa uno para ver su detalle.

![Catálogo de productos](capturas/03-catalogo.png)

En el detalle ves el nombre, el código, el precio y un indicador de disponibilidad. Elige la cantidad con los botones − y + y pulsa «Agregar al carrito».

![Detalle de un producto](capturas/04-detalle-producto.png)

«Promociones» reúne los productos con un descuento vigente. Si no hay ninguno, la pantalla lo dice.

### Carrito

En «Carrito» ves lo que agregaste, con el total. Puedes subir o bajar la cantidad de cada producto y quitarlo. Cuando algo del carrito deja de estar disponible, la pantalla te lo avisa. Pulsa «Continuar» para ir al checkout.

![Carrito de compras](capturas/06-carrito.png)

Los productos del carrito se reservan por unos 20 minutos mientras terminas la compra. Si no pagas a tiempo, la reserva se libera y otro cliente puede comprarlos.

### Checkout

En el checkout escribes la dirección de entrega, o marcas «Retirar en tienda» y eliges la tienda donde recogerás. Debajo, en «Cómo pagarás», siempre aparece **PayKlik · tarjeta y otros medios de pago**. Si cumples las condiciones, aparece también **Crédito MegaStore · paga en 30 días**, con el crédito que tienes disponible.

![Checkout con las opciones de pago](capturas/07-checkout-opciones-de-pago.png)

Cuando el crédito no está disponible, un texto debajo de las opciones explica por qué, por ejemplo que necesitas más compras entregadas. Pulsa «Confirmar compra» para crear la orden.

### Pagar con tarjeta

La orden queda creada y pendiente de pago. En ese momento puedes pagar con «Pagar ahora» o cancelarla con «Cancelar orden».

![Orden creada, pendiente de pago](capturas/08-orden-creada-pendiente-de-pago.png)

En la pantalla de pago elige el método: tarjeta de crédito o débito, transferencia bancaria, billetera digital o, si lo tienes disponible, el crédito de MegaStore. Con tarjeta, escribe el número de 16 dígitos y el CVV y pulsa «Pagar». En el entorno de prueba cualquier tarjeta de 16 dígitos, como `4242 4242 4242 4242`, se aprueba. El número de tu tarjeta nunca se guarda.

![Pantalla de pago con tarjeta](capturas/09-pago-con-tarjeta.png)

Al terminar, la orden avanza por los pasos Cobro, Pagado, Factura, Envío y Entrega. Cuando está pagada ves la guía del envío y la factura electrónica, con su autorización (CUI), su serie y la fecha. En el mismo detalle puedes pedir un cambio o una devolución, como se explica más abajo.

![Detalle de una orden pagada](capturas/10-detalle-de-la-orden-pagada.png)

### Comprar a crédito

En el checkout, elige «Crédito MegaStore · paga en 30 días». El texto debajo te recuerda tu crédito disponible y que la aprobación se confirma al pagar.

![Checkout con crédito seleccionado](capturas/11-checkout-con-credito.png)

Al confirmar, pasas a la pantalla de pago con el crédito ya elegido. Ahí el sistema te dice si tu historial es confiable y cuánto tienes disponible. Pulsa «Pagar»: no se cobra nada ahora.

![Pago con crédito](capturas/12-pago-a-credito.png)

El sistema evalúa tu historial en ese momento y te avisa si aprobó o rechazó la solicitud. Si la aprueba, la orden sigue su curso normal de factura, envío y entrega, y tienes 30 días para pagar. Si la rechaza, puedes continuar la compra con PayKlik.

![Orden pagada a crédito](capturas/13-orden-a-credito.png)

### Mi crédito

«Mi crédito» resume tu cuenta: crédito habilitado o el motivo por el que no lo está, tu límite, lo usado, lo disponible, el plazo, tus compras entregadas y el estado del historial.

![Mi crédito](capturas/15-mi-credito.png)

Más abajo ves el historial de solicitudes, con cada orden y si fue aprobada, y los cargos pendientes con su fecha de vencimiento. Para saldar un cargo, escribe el número de tarjeta y el CVV en la parte de arriba y pulsa «Pagar saldo». El abono confirmado aparece como «Pagado» y libera tu cupo. Si el abono falla, el motivo queda a la vista y puedes reintentarlo.

El crédito se gana comprando. Necesitas varias compras entregadas, sin devoluciones, incidencias ni pagos atrasados o rechazados en tu historial. Si el sistema que guarda tu historial no responde en ese momento, la opción de crédito no aparece y puedes seguir pagando con PayKlik.

### Seguir tus órdenes

«Mis órdenes» lista tus compras con su estado.

![Mis órdenes](capturas/14-mis-ordenes.png)

Al abrir una ves el detalle, como en la captura de arriba. En «Notificaciones» están todos los mensajes que te envió la tienda.

![Notificaciones](capturas/16-notificaciones.png)

### Cambios y devoluciones

En el detalle de una orden, la sección «Cambios y devoluciones» permite registrar una solicitud. Elige el tipo, devolución o cambio, escribe el motivo y pulsa «Registrar solicitud». El personal la revisa desde la administración. Mientras una solicitud está en revisión, tu crédito queda bloqueado para compras nuevas.

### Perfil

En «Perfil» actualizas tu nombre, teléfono y dirección.

![Perfil del cliente](capturas/17-perfil.png)

## Para el personal

Entra en `/administracion` con tu usuario y contraseña.

![Inicio de sesión del personal](capturas/20-admin-iniciar-sesion.png)

El menú lateral solo muestra las secciones que tu rol permite. Los roles son administrador, finanzas, logística, agente de call center, encargado de tienda y empleado de tienda.

### Qué se hace en cada sección

| Sección | Para qué sirve |
|---|---|
| Dashboard | Resumen general: ventas y órdenes de los últimos 30 días, incidencias abiertas, reservas activas, órdenes recientes y su estado |
| Órdenes | Buscar y revisar órdenes; abrir una para ver su detalle, pago, factura y trazabilidad |
| Venta asistida | Crear una compra en nombre de un cliente, desde el call center o la tienda |
| Incidencias y Devoluciones | Revisar y resolver problemas, cambios y devoluciones |
| Catálogo y promociones | Crear y editar productos y promociones |
| Ubicaciones y Traslados | Ver tiendas y centros de distribución, y registrar traslados entre ellos |
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

### Dashboard

El dashboard es la primera pantalla después de entrar.

![Dashboard de la administración](capturas/21-admin-dashboard.png)

### Órdenes y su detalle

«Órdenes» permite buscar por número, cliente o estado. Al abrir una, ves el avance (Cobro, Pagado, Factura, Envío, Entrega), los productos, la dirección, la guía de envío y la factura electrónica.

![Lista de órdenes](capturas/22-admin-ordenes.png)

![Detalle de una orden en la administración](capturas/41-admin-detalle-de-orden.png)

### Incidencias y devoluciones

Aquí llegan las solicitudes de cambio y devolución que registran los clientes y las incidencias que abre el personal. Quien tenga el rol correspondiente las procesa y cambia su estado hasta resolverlas. «Devoluciones» muestra solo las de tipo devolución; al resolverse, la orden pasa a DEVUELTA.

![Incidencias](capturas/23-admin-incidencias.png)

![Devoluciones](capturas/24-admin-devoluciones.png)

### Inventario, ubicaciones y traslados

«Inventario» muestra el stock por ubicación y permite registrar movimientos y ajustes. «Ubicaciones» lista las tiendas y los centros de distribución, y «Traslados» registra el movimiento de mercadería entre ellos.

![Inventario](capturas/28-admin-inventario.png)

![Ubicaciones](capturas/26-admin-ubicaciones.png)

![Traslados](capturas/27-admin-traslados.png)

### Logística y reservas

«Logística» coordina los envíos y el transporte; «Reservas» muestra el stock apartado por compras en curso.

![Logística](capturas/30-admin-logistica.png)

![Reservas](capturas/29-admin-reservas.png)

### Clientes y venta asistida

«Clientes» permite buscar clientes y abrir su ficha. «Venta asistida» sirve para continuar el carrito de un cliente por teléfono: se busca al cliente, o se crea si no existe, y la orden queda registrada en el canal CALL_CENTER.

![Clientes](capturas/31-admin-clientes.png)

![Venta asistida](capturas/40-admin-venta-asistida.png)

### Usuarios, auditoría y reportes

«Usuarios y roles» administra al personal. «Auditoría» muestra quién hizo cada acción y cuándo, y «Reportes» los de ventas y pagos.

![Usuarios y roles](capturas/32-admin-usuarios.png)

![Auditoría](capturas/33-admin-auditoria.png)

![Reportes](capturas/34-admin-reportes.png)

### ERP, facturas e integraciones

«ERP y conciliación» muestra los lotes que se envían al ERP, «Facturas» las emitidas, e «Integraciones» el estado de los sistemas externos.

![ERP y conciliación](capturas/35-admin-erp.png)

![Facturas](capturas/36-admin-facturas.png)

![Integraciones](capturas/38-admin-integraciones.png)

### Configuración y reglas del crédito

En «Configuración» están los parámetros del sistema. Los del crédito empiezan con `credit.`: el límite, el plazo, las compras y el importe mínimos, y los máximos de incidencias, devoluciones, pagos atrasados y pagos rechazados. Pulsa «Editar» en uno para cambiarlo. El cambio aplica a la siguiente compra, sin desplegar nada.

![Configuración del sistema, con los parámetros del crédito](capturas/37-admin-configuracion.png)

## Problemas frecuentes

| Qué ves | Qué hacer |
|---|---|
| «Error del servidor (502)» en la nube | El servicio estaba dormido; espera un minuto y reintenta |
| «correo o contraseña incorrectos» | Revisa el correo y la contraseña; si no tienes cuenta, créala en «Crear una» |
| Solo aparece PayKlik en el checkout | No cumples todavía las condiciones del crédito; el motivo aparece debajo de las opciones |
| El producto ya no está disponible al pagar | La reserva venció; vuelve a agregarlo al carrito |
| Una orden a crédito fue rechazada | Revisa «Mi crédito» para ver el motivo; puedes continuar con PayKlik |

Para el funcionamiento interno y el despliegue, consulta el [manual técnico](Manual_Tecnico_SGO-Logic.md).
