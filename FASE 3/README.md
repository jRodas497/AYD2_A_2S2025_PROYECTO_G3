# Fase 3: verificación automática de SGO-Logic

Desde la raíz del repositorio, en PowerShell, bash o una terminal del IDE:

```text
python "FASE 3/verificar.py"
```

Requiere Docker funcionando con contenedores Linux, Compose v2, Python 3.10+ y Node 22+. No requiere Maven, Java ni paquetes Python instalados. El comando instala las dependencias bloqueadas en `package-lock.json` y Chromium, compila, ejecuta todas las categorías y simulaciones, guarda evidencia y elimina únicamente su entorno temporal. La primera ejecución descarga imágenes y dependencias.

La aplicación probada es la de `FASE 2/`. Los proveedores PayKlik, SAT, LogiExpress, ERP, POS y mensajería son procesos HTTP independientes con persistencia, además de PostgreSQL y Kafka reales. Las pruebas de integración y de navegador no reemplazan la API por respuestas falsas.

El resultado completo solo es aprobado si todas las etapas pasan, cada categoría tiene al menos cinco casos ejecutados y no existen casos omitidos, fallidos o pendientes en los reportes. El proceso termina con código 0 al aprobar y 1 al fallar; los E2E se ejecutan sin reintentos para hacer visibles las fallas intermitentes.

## Documentación y evidencia

La organización del trabajo, el reparto entre integrantes, los incidentes y la retrospectiva: [GESTION-DEL-PROYECTO.md](GESTION-DEL-PROYECTO.md).

Los flujos principales para demostrar y probar el sistema, con diagramas y capturas: [FASE 3/FLUJOS](FLUJOS/README.md).

Los dos manuales del sistema, que pide el enunciado:

- [Manual técnico](DOCUMENTACION/Manual_Tecnico_SGO-Logic.md): arquitectura, componentes, crédito, despliegue, CI/CD y pruebas.
- [Manual de usuario](DOCUMENTACION/Manual_Usuario_SGO-Logic.md): cómo usar la tienda y la administración.

Las correcciones por el feedback de las fases 1 y 2, con los commits que lo comprueban: [CORRECCIONES-POR-FEEDBACK.md](CORRECCIONES-POR-FEEDBACK.md).

La arquitectura que agregó la fase (crédito propio y CI/CD con despliegue en la nube): [FASE 3/DDA](DDA/README.md), con dos ADR, los drivers y escenarios de calidad y los diagramas.

Lo específico del testeo:

- [Plan y criterios de aceptación](PLAN-PRUEBAS.md).
- [Matriz de requisitos y casos](MATRIZ-TRAZABILIDAD.md).
- [Guía técnica de las pruebas](GUIA-TECNICA-PRUEBAS.md).
- [Guía para ejecutar y demostrar las pruebas](GUIA-DEMO-PRUEBAS.md).
- [Resultados de la ejecución validada](EVIDENCIA.md).

Cada ejecución crea `resultados/<fecha UTC>-<id>/`. El archivo `resultados/ultimo.json` indica la ubicación y el resultado más reciente. Se generan reportes JUnit XML, métricas JSON con percentiles y muestras de CPU/memoria, logs por etapa, reporte HTML de Playwright y hashes SHA-256 de los artefactos. Los archivos voluminosos y datos de clientes de prueba quedan ignorados por Git; la evidencia resumida se conserva en Markdown. GitHub Actions publica los artefactos completos durante 14 días, incluso si falla la suite.

## Alcance

Esta carpeta cubre la verificación automática y las correcciones necesarias para ejecutar la aplicación según sus contratos. El enunciado (`Proyecto Fase 3.pdf`) exige cinco pruebas por cada categoría —unitarias, integración, E2E, estrés y carga— y la regresión de los flujos de las fases anteriores, además de la nueva regla de crédito.

El resto de lo que pide la fase vive en otros lugares del repositorio:

- El código del sistema, con la evaluación de crédito, está en `FASE 2/`.
- El CI/CD y el despliegue a la nube están en `.github/workflows/ci.yml`, `render.yaml` y [DEPLOY-RENDER.md](../DEPLOY-RENDER.md).
- Los manuales están en `DOCUMENTACION/`.
- La bitácora del trabajo por fecha está en [BITACORA.md](../BITACORA.md).
