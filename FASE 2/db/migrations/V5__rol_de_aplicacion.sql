-- El backend se conecta con este rol, nunca con el superusuario sgologic. sgologic queda
-- solo para migraciones y administración.
--
-- Como no es superusuario ni dueño de las tablas, sgologic_app no puede alterar la estructura:
-- no puede desactivar el trigger que protege la auditoría, ni agregar una columna, ni borrar
-- una tabla. Eso es lo que de verdad cierra el hueco de que el pago o la auditoría se manipulen
-- desde una conexión de la aplicación.
--
-- La contraseña real la fija V6__contrasena_de_la_app.sh a partir de DB_APP_PASSWORD. El valor
-- de aquí es un cierre temporal para que el rol nunca quede sin contraseña entre un paso y otro.
do $$ begin
    if not exists(select 1 from pg_roles where rolname='sgologic_app') then
        create role sgologic_app with login password 'se-cambia-en-V6';
    end if;
end $$;

grant usage on schema
    config, catalog, customers, inventory, orders, payments, invoicing, logistics,
    notifications, integration, audit
to sgologic_app;

-- Por defecto la app solo lee. Las tablas que necesita modificar se listan abajo con su permiso exacto.
grant select on all tables in schema
    config, catalog, customers, inventory, orders, payments, invoicing, logistics,
    notifications, integration, audit
to sgologic_app;

grant usage, select on all sequences in schema
    config, catalog, customers, inventory, orders, payments, invoicing, logistics,
    notifications, integration, audit
to sgologic_app;

-- Las tablas de referencia (channel, *_status, *_type, *_category, carrier, role, file_format)
-- se cargan y cambian por migración, nunca desde la aplicación: se quedan solo con el select de arriba.

-- Configuración: la app lee y actualiza valores, pero no crea ni borra llaves.
grant update on config.setting to sgologic_app;

-- Identidad: se crean y actualizan usuarios; no se borran (se desactivan con active = false).
grant insert, update on config.app_user to sgologic_app;
grant insert, delete on config.user_role to sgologic_app;

-- Catálogo y clientes
grant insert, update, delete on catalog.product to sgologic_app;
grant insert, update, delete on customers.customer to sgologic_app;

-- Inventario. insert en stock es para dar existencia inicial a un producto nuevo en una
-- ubicación (Configurar Catálogo de Productos); no es para abrir tiendas o centros nuevos.
grant update on inventory.location to sgologic_app;
grant insert, update on inventory.stock to sgologic_app;
grant insert on inventory.stock_movement to sgologic_app;
grant insert, update on inventory.reservation to sgologic_app;

-- Órdenes y carrito
grant insert, update, delete on orders.cart to sgologic_app;
grant insert, update, delete on orders.cart_item to sgologic_app;
grant insert, update on orders.purchase_order to sgologic_app;
grant insert on orders.order_item to sgologic_app;
grant insert, update on orders.incident to sgologic_app;

-- Pagos y auditoría: solo insertar. Ni siquiera se les da UPDATE o DELETE a nivel de permiso,
-- de modo que la regla no depende solo del trigger de audit.forbid_changes().
grant insert on payments.payment_attempt to sgologic_app;
grant insert on audit.audit_log to sgologic_app;

-- Facturación, logística y notificaciones
grant insert, update on invoicing.invoice to sgologic_app;
grant insert, update on logistics.shipment to sgologic_app;
grant insert on logistics.tracking_event to sgologic_app;
grant insert, update on notifications.notification to sgologic_app;

-- Integración
grant insert, update on integration.outbox to sgologic_app;
grant insert, update on integration.pos_event to sgologic_app;
grant insert, update on integration.erp_batch to sgologic_app;
grant insert on integration.erp_batch_order to sgologic_app;
