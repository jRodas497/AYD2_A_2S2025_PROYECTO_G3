#!/bin/sh
set -eu
export PGPASSWORD="${POSTGRES_PASSWORD:-}"
export PGHOST="${PGHOST:-db}" PGUSER="${POSTGRES_USER:-sgologic}" PGDATABASE="${POSTGRES_DB:-sgologic}"
sql() {
  if [ -n "${DATABASE_URL:-}" ]; then psql "$DATABASE_URL" "$@"; else psql "$@"; fi
}
legacy=$(sql -Atc "select to_regclass('public.schema_migration') is null")
sql -v ON_ERROR_STOP=1 -c 'create table if not exists public.schema_migration (version text primary key, applied_at timestamptz not null default now())'
# Adopt databases created by the original V1..V9 initialization without erasing data.
if [ "$legacy" = "t" ]; then
sql -v ON_ERROR_STOP=1 <<'SQL'
insert into public.schema_migration(version)
select version from (values
 ('1', to_regclass('orders.purchase_order') is not null),
 ('2', to_regclass('orders.purchase_order') is not null),
 ('3', to_regclass('config.app_user') is not null),
 ('4', to_regprocedure('audit.has_card_number(text)') is not null),
 ('5', to_regclass('orders.purchase_order') is not null and exists(select 1 from pg_roles where rolname='sgologic_app')),
 ('6', exists(select 1 from pg_roles where rolname='sgologic_app')),
 ('9', exists(select 1 from information_schema.columns where table_schema='customers' and table_name='customer' and column_name='password_hash'))
) as legacy(version, present) where present on conflict do nothing;
do $$ begin
  if to_regclass('config.app_user') is not null then
    if exists(select 1 from config.app_user where username='admin') then
      insert into public.schema_migration(version) values('7') on conflict do nothing;
    end if;
  end if;
end $$;
SQL
fi
for file in $(find /migrations -maxdepth 1 -type f -name 'V*' | sort -V); do
  version=$(basename "$file" | sed 's/^V\([0-9]*\)__.*/\1/')
  if [ "$(sql -Atc "select count(*) from public.schema_migration where version='$version'")" = 0 ]; then
    case "$file" in
      *.sql) sql -v ON_ERROR_STOP=1 --single-transaction -f "$file" -c "insert into public.schema_migration(version) values ('$version')" ;;
      *.sh) sql -v ON_ERROR_STOP=1 -c "insert into public.schema_migration(version) values ('$version')" ;; # Password is set below on every startup.
    esac
  fi
done
sql -v ON_ERROR_STOP=1 -v app_password="$DB_APP_PASSWORD" <<'SQL'
alter role sgologic_app with password :'app_password';
SQL
