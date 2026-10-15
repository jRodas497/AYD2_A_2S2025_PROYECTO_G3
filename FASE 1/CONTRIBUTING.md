# Flujo de trabajo — GitFlow

Este repo sigue **GitFlow** adaptado a un proyecto de documentación arquitectónica (no de desarrollo de software puro). Reglas simples, para que el equipo de 5 no pierda tiempo en el flujo en vez de en el DDA.

## Ramas

| Rama | Propósito | Quién le hace push directo |
|---|---|---|
| `master` | Solo estados **entregables** (lo que se presenta al comité). Cada entrega importante se marca con un tag. | Nadie — solo vía PR desde `develop` |
| `develop` | Rama de integración. Es el estado "actual" real del trabajo del equipo. | Nadie — solo vía PR desde `feature/*` |
| `feature/<carné>-<slug>` | Una tarjeta del Kanban = una rama, prefijada con el carné de quien la trabaja. Ej. `feature/9516085-stakeholders`, `feature/202109114-diagrama-despliegue`. | El integrante que la trabaja |
| `hotfix/<slug>` | Corrección urgente sobre algo ya en `master` (ej. error detectado horas antes de la defensa). Sale de `master`, se mezcla a `master` **y** a `develop`. | Quien detecta el problema |

> Nota: GitHub Free en repos privados de cuenta personal no permite reglas de protección de rama automáticas (requiere GitHub Pro/organización). La regla "nadie hace push directo a `master`/`develop`" es de **disciplina de equipo**, no está forzada por la plataforma — respétenla igual.

## Ciclo de trabajo (mapeado al tablero Kanban de `Docs/Kanban/README.md`)

1. Tarjeta pasa a **In Progress** → crear `feature/<carné>-<slug>` desde `develop` actualizado:
   ```
   git checkout develop && git pull
   git checkout -b feature/9516085-mi-tarjeta
   ```
2. Commits pequeños y descriptivos sobre esa rama.
3. Tarjeta pasa a **Ready for Testing** → abrir Pull Request `feature/<carné>-<slug>` → `develop`. Pedir revisión de al menos 1 compañero (aunque no esté forzado por GitHub, es la regla del equipo).
4. Tarjeta pasa a **Test/QA** → revisar manualmente `Docs/DDA/07-matrices-trazabilidad.md` contra la sección nueva/modificada (todo stakeholder con driver, todo driver con decisión y vista) antes de aprobar el PR.
5. PR aprobado → merge a `develop` (squash o merge normal, indistinto) → tarjeta a **Done**.
6. En cada hito de entrega (ej. entrega final 2026-08-26): PR `develop` → `master`, merge, y `git tag entrega-fase1 && git push --tags`.

## Convención de nombres de rama

`feature/<carné>-<área>-<detalle-corto>` en kebab-case — el carné identifica a quién le corresponde la tarjeta (ver roster en `README.md`). Ej.:
- `feature/9516085-stakeholders-preocupaciones`
- `feature/202109114-eac-resiliencia-pagos`
- `feature/199919737-diagrama-contexto`
- `feature/202200389-adr-integracion-erp`
- `feature/202001132-mockups-checkout`

## Mensajes de commit

Formato libre pero descriptivo — no hace falta Conventional Commits estricto para este proyecto, pero sí evitar mensajes tipo "cambios" o "wip". Preferir:
```
Agrega stakeholders ST-05 a ST-08 con evidencia del caso
Documenta ADR-0001: estrategia de resiliencia de pagos
```

## Actualización de la Fase 3

La Fase 3 mantiene el flujo de arriba con estos cambios, que piden el enunciado y el despliegue continuo:

| Tema | Regla de la Fase 3 |
|---|---|
| Rama de entregas | Se llama `main` (en las fases anteriores se usó `master` en este documento). Solo recibe cambios desde `develop` |
| Versiones | Cada entrega es un tag con el formato `v1`, `v2`, `v3`… sobre `main`, con su release en GitHub y su entrada en el [CHANGELOG](../CHANGELOG.md). El enunciado pide mínimo cuatro durante la fase |
| Mensaje de commit | `carnet: mensaje`, por ejemplo `9516085: se agregó el manual de usuario`. Es la prueba de quién hizo qué |
| Merges | Un merge de pull request no cuenta como commit de trabajo: lo que cuenta son los commits de la rama |
| Pruebas antes de integrar | Cada push a `develop` y a las ramas `feature/*`, y cada pull request, corre el CI (`.github/workflows/ci.yml`): pruebas del backend, del frontend y la suite de la Fase 3 |
| Despliegue | Render despliega un commit de `develop` solo cuando todos los checks del CI pasan. Detalle en [DEPLOY-RENDER.md](../DEPLOY-RENDER.md) y en el [ADR-0011](../FASE%203/DDA/ADR/0011-cicd-y-despliegue-en-la-nube.md) |
| Migraciones de base | Si una versión agrega una migración, se aplica a Neon con `aplicar-migraciones-nube.sh` antes del deploy |

### Cómo se publica una versión

1. Con `develop` en verde, abrir un pull request `develop` → `main` y mezclarlo.
2. Agregar la versión al `CHANGELOG.md`.
3. Crear el release sobre `main`: `gh release create v2 --target main --title "v2: <tema>" --notes-file <notas>`.
4. Comprobar que la aplicación en Render responde con el despliegue nuevo.

