# ADR-0011: CI/CD con gate de pruebas y despliegue en Render, Neon y Cloudflare R2

**Estado:** Aceptada
**Fecha:** 2026-10-14
**Decisores:** Equipo del Grupo 3

## Contexto

El ADR-0005 decidió desplegar on-premises y dejar la evolución a la nube como camino futuro. La Fase 3 pide justo ese paso: desplegar la arquitectura en la nube con integración y despliegue continuos, usando GitHub Actions o GitLab, y con una regla explícita: no se debe hacer deploy si las pruebas no pasan.

El presupuesto del proyecto es académico, así que la infraestructura tiene que caber en planes gratuitos, y eso impone límites que la arquitectura debe absorber:

- Un servicio web gratuito de Render **no recibe tráfico por la red privada**, solo puede enviarlo.
- Los servicios gratuitos se duermen tras 15 minutos sin tráfico.
- El Postgres gratuito de Render caduca a los 30 días y el disco de un servicio no persiste entre despliegues.
- No hay Kafka ni los seis proveedores simulados en el plan gratuito.

Además hubo un incidente real: los deploys del 12 y 13 de octubre fallaron en el health check porque Render desplegaba cada commit sin esperar a las pruebas y sin aplicar las migraciones a la base. El backend nuevo arrancaba contra un esquema viejo.

## Decisión

1. **GitHub Actions** con tres etapas en `.github/workflows/ci.yml`: build y pruebas rápidas (backend y frontend), pruebas de la Fase 3 sobre el docker-compose completo, y deploy.
2. **El deploy lo hace Render y depende de las pruebas.** Los dos servicios tienen `autoDeployTrigger: checksPass` en `render.yaml`: Render despliega un commit de `develop` solo cuando todos los checks de GitHub Actions pasan. Si fallan backend, frontend o la suite de la Fase 3, no hay deploy.
3. **El workflow no tiene un job de deploy propio.** Si lo tuviera y esperara a que Render termine, Render esperaría a ese job y los dos quedarían esperándose. El deploy queda entonces como una etapa de Render, gobernada por el resultado del CI.
4. **Las migraciones se aplican a mano** con `aplicar-migraciones-nube.sh` antes de un deploy que agregue una. Es incremental y no toca los datos. Queda documentado en `DEPLOY-RENDER.md`.
5. **El health check de Render** (`/api/products`) valida que el backend nuevo responde antes de reemplazar al anterior; si no responde, Render conserva la versión que funciona.
6. **Docker en backend y frontend**: `Dockerfile.backend` y `Dockerfile.frontend` en la raíz, los mismos que usa docker-compose. Una sola fuente para local y nube.
7. **Servicios gestionados gratuitos para lo que no persiste en Render:** Neon para PostgreSQL y Cloudflare R2 para el archivo del ERP, que no caducan.
8. **El frontend llega al backend por su URL pública** (`BACKEND_URL`), con un `resolver` en nginx para resolverla en cada petición. El nombre interno no sirve porque el backend gratuito no recibe tráfico privado.
9. **La nube es una vista parcial.** Kafka y los seis proveedores se levantan solo en docker-compose; el catálogo, el login, el carrito y las consultas funcionan en Render. El `render.yaml` lo dice en su encabezado.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Auto-Deploy de Render por commit | Cero configuración | Despliega aunque las pruebas fallen; ya causó el incidente | Incumple el gate del enunciado |
| Un job `deploy` en GitHub que dispara Render con Deploy Hooks | El deploy es una etapa visible en Actions y puede aplicar las migraciones | Exige secretos en GitHub (hooks y cadena de la base) y más piezas que mantener | Se prefirió que Render despliegue por su cuenta, con el gate de `checksPass`, y sin credenciales en GitHub |
| Postgres de Render | Todo en un solo proveedor | Caduca a los 30 días en el plan gratuito | Neon no expira |
| Kubernetes en un proveedor de nube | Es la vista objetivo de las fases anteriores | Costo y operación fuera del presupuesto y de la capacidad del equipo | El enunciado pide desplegar con Docker |
| Llamar al backend por su nombre privado | Sin salir a internet | No funciona con un servicio gratuito | Es el error que se vio en el primer deploy |

## Consecuencias

**Positivas:**
- Ningún commit llega a producción sin haber pasado la suite de 242 casos.
- No hay credenciales de Render ni de la base guardadas en GitHub.
- Los mismos Dockerfile sirven en local, en CI y en la nube.

**Negativas / tradeoffs aceptados:**
- El primer acceso tras un rato de inactividad tarda hasta un par de minutos y puede devolver 502. Conviene abrir la tienda antes de una demostración.
- El pipeline completo tarda entre 5 y 20 minutos según la carga del runner, por las pruebas sobre el stack completo; el feedback de un cambio no es inmediato.
- Las migraciones no se aplican solas: quien agregue una debe correr el script antes del deploy. Un olvido hace fallar el health check y Render conserva la versión anterior.
- Los flujos que dependen de Kafka o de un proveedor simulado no se ven completos en la nube.

## Drivers que atiende

- RC 10 y R 03 (contenedores), R 05 y R 06 (control de versiones y git-flow), RC 03 (escalabilidad horizontal, evolución del ADR-0005)
- R 08 y R 09 (presupuesto): infraestructura en planes gratuitos
- Nuevos: RN-D01 y CC-05 a CC-06 de [drivers-y-escenarios-fase3.md](../drivers-y-escenarios-fase3.md)

## Vistas afectadas

- [diagramas-fase3.md](../diagramas-fase3.md): pipeline y despliegue en la nube
- `.github/workflows/ci.yml`, `render.yaml`, `Dockerfile.backend`, `Dockerfile.frontend`, `DEPLOY-RENDER.md`
