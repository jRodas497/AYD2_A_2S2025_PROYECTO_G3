-- Un solo usuario de demo, para poder loguearse y probar el catálogo protegido.
-- Usuario: admin  Contraseña: admin123 (hash bcrypt, generado aparte; la base nunca ve la
-- contraseña en texto plano ni la genera ella misma).

insert into config.app_user (username, full_name, email, password_hash, active)
values (
    'admin',
    'Administrador de prueba',
    'admin@example.com',
    '$2b$10$84GOCyCznaYYlcN/e/OJIOAFshhxcGkCyIXc7WtQUA5gQX9d19mRy',
    true
);

insert into config.user_role (user_id, role_id)
select u.id, r.id
from config.app_user u
cross join config.role r
where u.username = 'admin' and r.code = 'ADMIN';
