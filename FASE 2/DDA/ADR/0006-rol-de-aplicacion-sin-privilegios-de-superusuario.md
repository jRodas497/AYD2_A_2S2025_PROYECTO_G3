# ADR-0006: Rol de base de datos de la aplicación sin privilegios de superusuario

**Estado:** Propuesta
**Fecha:** 2026-09-21
**Decisores:** Quien diseña la base de datos (Backend 1) — pendiente de ratificación en reunión de equipo

## Contexto

Al construir la base de SGO-Logic se implementaron dos protecciones que exigen RC 06 y RC 07 (Fase 2), continuación de DC-07 y DC-08 (Fase 1): que la tabla de auditoría y la de intentos de cobro solo acepten inserciones, y que ningún texto libre pueda guardar un número que parezca de tarjeta.

Al probar esas protecciones apareció un hueco que ninguna restricción explícita cubría: la base venía con un solo usuario, dueño de todas las tablas y con privilegios de superusuario, y ese es el mismo usuario con el que se pensaba conectar el backend. Con esa conexión, cualquier código —por error o por una vulnerabilidad explotada— puede desactivar el trigger que protege la auditoría, agregarle una columna a una tabla o borrarla directamente. El trigger deja de ser una protección real si quien se conecta puede simplemente apagarlo.

## Decisión

El backend, y cualquier herramienta de uso diario (incluido quien solo consulta datos), se conecta a Postgres con un rol nuevo, `sgologic_app`, que no tiene privilegios de superusuario ni es dueño de ninguna tabla. Sus permisos se otorgan de forma explícita, tabla por tabla: solo lectura en las tablas de referencia, solo inserción en auditoría y en pagos, y los permisos de escritura que cada tabla de negocio necesita para operar. El usuario `sgologic`, dueño de las tablas y con privilegios de superusuario, queda reservado para las migraciones y la administración de la base.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Un solo usuario (`sgologic`) para todo | Es lo que trae Postgres por defecto; nada que configurar | Cualquier conexión de la aplicación puede alterar la estructura, desactivar el trigger de auditoría o borrar una tabla | Anula en la práctica lo que RC 06 y RC 07 piden: un error de código o una inyección podría manipular auditoría o pagos sin que la base lo impida |
| Rol de aplicación con lectura y escritura amplia, sin distinguir tabla por tabla | Menos configuración que el permiso detallado | No protege las tablas de referencia de un cambio accidental, ni le quita a la app el permiso de `UPDATE`/`DELETE` sobre pagos y auditoría | La protección de auditoría seguiría dependiendo solo del trigger, sin una segunda barrera a nivel de permiso |
| Rol de aplicación sin superusuario, con permisos tabla por tabla (elegida) | Cierra el hueco de raíz: al no ser dueño, no puede alterar la estructura ni desactivar un trigger, sin importar qué bug tenga el código de la aplicación | Cada tabla nueva que agregue una migración debe sumar también su permiso, o quedará solo de lectura para la app | Es el balance correcto entre seguridad real y mantenimiento razonable para un equipo de 5 |

## Consecuencias

**Positivas:**
- Un backend con un bug o comprometido no puede desactivar el trigger de auditoría/pagos, agregar una columna oculta ni borrar una tabla.
- Las tablas de referencia (canales, estados, tipos) no se pueden alterar por accidente desde la aplicación.

**Negativas / tradeoffs aceptados:**
- Al agregar una tabla en una migración nueva hay que sumar también su `GRANT` correspondiente, o la aplicación solo podrá leerla.

## Drivers que atiende

- RC 06, RC 07 (Fase 2) — refuerza, a nivel del motor de base de datos, que esas protecciones no dependan únicamente de la lógica de la aplicación.
- DC-07, DC-08 (Fase 1) — por continuidad con la auditabilidad y la seguridad de datos de pago ya definidas.

## Vistas afectadas

- `FASE 2/db/migrations/V5__rol_de_aplicacion.sql`
- `FASE 2/db/migrations/V6__contrasena_de_la_app.sh`
- `FASE 2/db/README.md`, sección "Seguridad"
