-- Usuarios y roles del personal que usa el sistema (componente Identity / Configuration Service).
-- Los clientes finales no están aquí: son datos de negocio en customers.customer.
-- No se cargan usuarios de ejemplo a propósito, para no dejar credenciales conocidas.

-- Roles tomados de los actores de los casos de uso y de los stakeholders del DDA.
create table config.role (id smallint primary key, code text not null unique, name text not null);
insert into config.role (id, code, name) values
    (1, 'ADMIN', 'Administrador'),
    (2, 'STORE_EMPLOYEE', 'Empleado de tienda'),
    (3, 'STORE_MANAGER', 'Gerente de tienda'),
    (4, 'CALL_CENTER_AGENT', 'Agente del centro de atención'),
    (5, 'LOGISTICS', 'Logística'),
    (6, 'FINANCE', 'Finanzas');

create table config.app_user (
    id              bigint generated always as identity primary key,
    username        text not null unique,
    full_name       text not null,
    email           text unique,
    -- Hash hecho por el backend (bcrypt, argon2, etc.), nunca la contraseña. La restricción rechaza texto plano.
    password_hash   text not null check (password_hash ~ '^(\{(bcrypt|argon2|pbkdf2|scrypt)\})?\$'),
    active          boolean not null default true,
    failed_attempts integer not null default 0 check (failed_attempts >= 0),
    locked_until    timestamptz,
    last_login_at   timestamptz,
    -- Tienda a la que pertenece un empleado o gerente de tienda. Los demás roles no la llevan.
    store_id        bigint references inventory.location (id),
    created_at      timestamptz not null default now()
);

create table config.user_role (
    user_id bigint not null references config.app_user (id) on delete cascade,
    role_id smallint not null references config.role (id),
    primary key (user_id, role_id)
);

create index on config.user_role (role_id);
