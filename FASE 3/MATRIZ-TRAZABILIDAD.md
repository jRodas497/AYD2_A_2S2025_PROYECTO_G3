# Matriz de trazabilidad del testeo

| Criterio del enunciado | Casos y archivo | Resultado esperado | Evidencia automática |
|---|---|---|---|
| Pág. 6: ≥ 5 unitarias aisladas | `FASE 2/backend/src/test/java/com/sgologic/payments/CreditServiceTest.java`, U01–U08 (U04 con 5 entradas), más suites preexistentes backend/frontend | Reglas y contratos correctos, sin dependencias de red/base | `junit-backend/TEST-*.xml`, `unitarias-frontend.xml` |
| Pág. 6: ≥ 5 integraciones | `test_integracion.py`, I01–I08 | ERP, crédito, pagos, auditoría, notificaciones y downstream coordinados | `integracion.xml` |
| Pág. 7/9: ≥ 5 cargas | `test_capacidad.py`, L01–L05 | Latencia, recursos y venta completa bajo carga normal | `carga.xml`, `carga.json` |
| Pág. 7/9: ≥ 5 estrés | `test_capacidad.py`, S01–S05 | Integridad bajo 8×/contención/fallas y disponibilidad posterior | `estres.xml`, `estres.json` |
| Pág. 7/9: ≥ 5 E2E | `FASE 2/frontend/e2e/fase3-credito.spec.ts`, E01–E05; suite anterior completa | Navegador opera sobre aplicación y API reales | `e2e.xml`, `playwright-report/` |
| Pág. 5: crédito según conducta real | U01–U06; I01, I02, I03; E01, E02, E03 | Historial ERP habilita; cliente nuevo, mora, devolución, incidencia o rechazo bloquean | XML, decisiones persistidas y notificaciones |
| Pág. 5: importe comprado y puntualidad | U03, U04; I03 | Se respetan los límites exactos de importe y comportamiento | XML unitario e integración |
| Pág. 5: checkout rápido sin congelación | I06; L04; S05; E05 | ERP limitado por timeout; tarjeta y crédito operan independientemente | Tiempos JSON y XML |
| Pág. 5: rutas convergentes y cliente informado | I02, I04, I07; E02, E04; `prueba_fase2.py` | Decisión guardada, aprobación/rechazo notificado; factura/guía tras pago válido | XML, registros SQL y entrega de avisos |
| Límite de crédito concurrente | U07, U08; I05; `prueba_operaciones.py` | Nunca se excede límite ni se crea deuda duplicada | XML, invariantes SQL |
| Regresión de RF04/RC08 (reserva) | S02, S04; `prueba_reserva_concurrente.py`, `prueba_pendientes.py` | Stock atómico, vencimiento, rollback y liberación | Logs e invariantes PostgreSQL |
| Regresión RC01/RC02 (consulta/auditoría) | L02, L03; `prueba_rendimiento.py` | Estado < 5 s, cobros < 1 s | JSON con máximo y percentiles |
| Calidad: recuperación automática | S05; `prueba_caidas.py`, `prueba_pendientes.py` | Recuperación tras stop/start y replay sin cobro duplicado | Logs por etapa |
| Calidad: límites de acceso y privacidad | I08; `prueba_seguridad.py`; E2E de permisos/sesión/perfil | 401/403, revocación y tokenización de tarjeta | Logs, XML y requests E2E |
| Regresión: tokens simulados sin falsos positivos de tarjeta | `FASE 2/frontend/src/shared/api/paymentToken.test.ts` (6 casos); `CardDataGuardTest` | UUID con secuencias numéricas conserva unicidad sin aparentar PAN; PAN reales siguen rechazados | XML frontend/backend |
| Pág. 7: etapa Test automática, bloqueante | `verificar.py`, job `e2e` del CI existente | Fallos o evidencia incompleta terminan con código 1 | `resumen.json`, resultado del job |
| Pág. 9: documentación Markdown | Plan, matriz y manuales en este directorio | Ejecución, criterios y resultados comprensibles | Archivos versionados |

Los criterios de despliegue, releases, git-flow académico, ampliación de arquitectura y revisión por docentes se excluyen de esta matriz de testeo por el alcance indicado. No se atribuyen puntos ni pesos no incluidos en el PDF disponible.

## Inventario mínimo de aceptación

| Categoría | Casos distintos nuevos | Mínimo del PDF |
|---|---:|---:|
| Unitarias de crédito | 12 ejecuciones en 8 métodos | 5 |
| Integración de crédito | 8 | 5 |
| Carga | 5 | 5 |
| Estrés | 5 (S01 contiene 4 escalones) | 5 |
| E2E de crédito | 5 | 5 |

Las suites anteriores también se ejecutan. Los conteos definitivos de la corrida completa se leen de XML y se documentan en [EVIDENCIA.md](EVIDENCIA.md).
