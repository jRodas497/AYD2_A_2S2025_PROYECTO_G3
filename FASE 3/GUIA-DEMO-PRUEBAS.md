# Guía para ejecutar y demostrar las pruebas

## Obtener un resultado verificable

1. Abrir Docker y esperar a que esté funcionando.
2. Abrir una terminal en la raíz del repositorio.
3. Ejecutar `python "FASE 3/verificar.py"`.
4. Esperar a que aparezca `REPORTES:` con la ubicación de los resultados.
5. Abrir `FASE 3/resultados/ultimo.json`. Para la entrega deben figurar `passed: true`, `complete_acceptance: true` y al menos cinco casos por categoría en `tests`.

No se solicita ningún dato durante la ejecución. Se crean los usuarios y los productos de prueba, se provocan las fallas, se recuperan los proveedores y se verifica el resultado automáticamente. Las fallas provocadas no son fallas de la suite cuando el sistema conserva la información y se recupera como exige cada caso.

Para ver las pruebas de navegador, abrir `playwright-report/index.html` dentro de la carpeta de la corrida. Para presentar las métricas, abrir `carga.json`, `estres.json` y [EVIDENCIA.md](EVIDENCIA.md). Los números deben corresponder a la corrida que se está presentando.

## Demostrar la aplicación con datos de prueba

Si se quiere inspeccionar la aplicación después de las pruebas, ejecutar el mismo comando con `--keep-stack`. La tienda queda en `http://127.0.0.1:18081` y la administración en `/administracion`. El administrador de prueba es `admin` con contraseña `admin123`. Los datos temporales pueden retirarse con el comando de limpieza del [guía técnica](GUIA-TECNICA-PRUEBAS.md).

### Compra con pago tradicional

Crear una cuenta desde «Ingresar», abrir un producto, agregarlo al carrito y pasar al checkout. Escribir la dirección o elegir retiro en tienda. Un cliente nuevo verá la opción PayKlik y la explicación de por qué todavía no tiene crédito. Confirmar la compra, seleccionar «Pagar ahora», introducir una tarjeta de prueba y CVV y confirmar. La orden avanza por pago, factura y despacho; sus detalles permiten consultar los avisos y el seguimiento.

### Compra con crédito propio

Un cliente con compras entregadas suficientes, importe mínimo y comportamiento de pago confiable recibe la opción «Crédito MegaStore · paga en 30 días» junto a PayKlik. El sistema considera tanto su historial de compras de SGO-Logic como el historial del ERP. Elegir crédito en checkout y confirmar el pago. La aprobación crea la deuda, la factura y el despacho y se informa al cliente.

Abrir «Mi crédito» para consultar el límite, usado, disponible, solicitudes y vencimiento. Introducir una tarjeta de prueba y CVV para pagar el saldo. El abono confirmado aparece como «Pagado» y libera el disponible. Si PayKlik está temporalmente caído, se informa que el abono está en proceso; se confirma al recuperarse el proveedor.

### Crédito rechazado y continuidad de la compra

Pagos vencidos o atrasados, incidencias, devoluciones y rechazos por encima de los criterios permitidos bloquean una nueva compra a crédito. Si el historial cambia después del checkout, el sistema vuelve a evaluar al cobrar, muestra el motivo del rechazo y permite continuar con PayKlik en la misma orden. El rechazo queda disponible en las solicitudes de crédito y se notifica al cliente.

Si el ERP está caído y no existe historial vigente, la opción de crédito se retira y se puede seguir con PayKlik. Las pruebas E01–E05 verifican estos recorridos en Chromium sin intervención humana.

## Leer un fallo

Un código de salida 1 o `passed: false` significa que la corrida no aprobó. Buscar el primer elemento de `stages` con `exit_code` diferente de 0 y abrir su archivo `.log`. Los E2E fallidos incluyen evidencia en el HTML. No presentar una corrida parcial o fallida como validación completa; después de corregir, repetir el comando completo.
