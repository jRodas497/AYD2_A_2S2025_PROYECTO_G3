# Arquitectura de la Fase 3

Extensión de la arquitectura de las fases 1 y 2 para el crédito propio y para el despliegue continuo en la nube. No reemplaza los documentos anteriores: los completa.

- [Drivers y escenarios de calidad](drivers-y-escenarios-fase3.md): actores, drivers nuevos y escenarios, con la prueba que verifica cada uno.
- [Diagramas](diagramas-fase3.md): componentes del crédito, secuencia del checkout, pipeline de CI/CD y despliegue.
- Casos de uso nuevos:
  - [CDU-09: comprar a crédito](casos-de-uso/CDU-09-comprar-a-credito.md)
  - [CDU-10: abonar el saldo de un crédito](casos-de-uso/CDU-10-abonar-saldo-de-credito.md)
- [ADR-0010: evaluación de crédito propio](ADR/0010-evaluacion-de-credito-propio.md)
- [ADR-0011: CI/CD y despliegue en la nube](ADR/0011-cicd-y-despliegue-en-la-nube.md)
- [ADR-0012: Kafka como broker, con el outbox como puente](ADR/0012-kafka-como-broker-con-el-outbox-como-puente.md)

Los ADR 0001 a 0005 están en [FASE 1](../../FASE%201/Docs/ADR/) y del 0006 al 0009 en [FASE 2](../../FASE%202/DDA/ADR/).

El ADR-0012 evoluciona al [ADR-0007](../../FASE%202/DDA/ADR/0007-outbox-en-la-base-como-broker-del-mvp.md), y los documentos de la Fase 2 que describen el MVP llevan una nota de actualización que apunta aquí.
