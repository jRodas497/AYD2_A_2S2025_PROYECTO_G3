# Diagramas de la Fase 3

Vistas de lo que la Fase 3 agregó: el crédito propio en el checkout, el pipeline de CI/CD y el despliegue en la nube. Están en Mermaid para que se lean directo en GitHub y se editen como texto. Las vistas de las fases anteriores siguen en [FASE 2/DDA](../../FASE%202/DDA/).

## Componentes: el crédito dentro del monolito

El crédito no es un módulo aislado. Vive en el componente de pagos, usa el historial del ERP a través de una proyección local y se comunica con el resto por el outbox, como pide la extensión disciplinada de la arquitectura ([ADR-0010](ADR/0010-evaluacion-de-credito-propio.md)).

```mermaid
flowchart LR
    subgraph Canales
        W[Tienda web]
        B[Backoffice]
    end

    subgraph Backend["Backend: un contenedor Spring Boot"]
        O[orders<br/>carrito y checkout]
        P[payments<br/>PayKlik y CreditService]
        H[integration/erp<br/>historial del cliente]
        OB[integration<br/>outbox y relé]
        N[notifications]
        A[audit]
        C[config<br/>parámetros credit.*]
    end

    DB[(PostgreSQL<br/>un esquema por componente)]
    K{{Kafka<br/>orders · notifications · pos · erp}}

    subgraph Terceros["Terceros simulados"]
        PK[PayKlik]
        ERP[ERP]
        SAT[SAT]
        LX[LogiExpress]
    end

    W --> O
    B --> O
    O --> P
    P -- evalúa elegibilidad --> H
    P -- lee criterios --> C
    P -- decisión y cargos --> DB
    H -- proyección, límite de 800 ms --> DB
    H -. lee historial .-> ERP
    P -- cobro y abonos --> PK
    P --> A
    P -- avisos y pasos posteriores --> OB
    OB --> DB
    OB --> K
    K --> N
    K --> SAT
    K --> LX
    K --> ERP
```

## Secuencia: checkout con decisión de crédito

El cliente nunca queda esperando: si el crédito no está disponible, la ruta de PayKlik sigue abierta.

```mermaid
sequenceDiagram
    actor Cliente
    participant Tienda as Frontend
    participant Ord as orders
    participant Cred as payments / CreditService
    participant Hist as Historial ERP
    participant ERP
    participant PK as PayKlik
    participant Out as Outbox y Kafka

    Cliente->>Tienda: Pulsa Checkout
    Tienda->>Cred: GET crédito del cliente
    Cred->>Hist: ¿Historial vigente?
    alt Hay proyección vigente
        Hist-->>Cred: Historial local
    else Refrescar
        Hist->>ERP: GET /history (límite 800 ms)
        alt Responde
            ERP-->>Hist: Historial
            Hist-->>Cred: Historial actualizado
        else No responde
            Hist-->>Cred: Sin historial vigente
        end
    end
    Cred-->>Tienda: Elegible o no, con el motivo
    Tienda-->>Cliente: PayKlik, y crédito si es elegible

    alt Cliente elige crédito
        Cliente->>Tienda: Confirma la orden
        Tienda->>Ord: Checkout con crédito
        Ord->>Cred: Autorizar (candado por cliente)
        Cred->>Cred: Evalúa criterios y guarda la decisión
        alt Aprobada
            Cred-->>Ord: Cargo a 30 días
            Ord->>Out: Orden pagada, factura, envío y aviso
        else Rechazada
            Cred-->>Ord: Motivo del rechazo
            Ord->>Out: Aviso al cliente
            Ord-->>Tienda: Rechazada, puede seguir con PayKlik
        end
    else Cliente elige PayKlik
        Tienda->>Ord: Checkout con tarjeta
        Ord->>PK: Cobro
        PK-->>Ord: Aprobado o rechazado
        Ord->>Out: Pasos posteriores
    end
    Out-->>Cliente: Notificación del resultado
```

## Pipeline de CI/CD

Render despliega solo si los checks pasan ([ADR-0011](ADR/0011-cicd-y-despliegue-en-la-nube.md)).

```mermaid
flowchart LR
    DEV[Integrante] -- push o PR --> GH[GitHub]
    GH --> BE[backend<br/>mvn test]
    GH --> FE[frontend<br/>tsc, Vitest, oxlint, build]
    BE --> E2E
    FE --> E2E
    E2E[Pruebas de Fase 3<br/>integración, carga, estrés,<br/>caídas y E2E en Docker]
    E2E -- todos los checks pasan --> R[Render<br/>autoDeployTrigger: checksPass]
    E2E -- algún check falla --> STOP([Render no despliega<br/>y conserva la versión anterior])
    R --> HC{Health check<br/>/api/products}
    HC -- responde 200 --> OK([Versión nueva en producción])
    HC -- no responde --> KEEP([Render conserva la<br/>versión anterior])
```

## Despliegue en la nube

Vista parcial: Kafka y los proveedores solo existen en docker-compose ([ADR-0011](ADR/0011-cicd-y-despliegue-en-la-nube.md)).

```mermaid
flowchart TB
    U[Navegador del cliente o del personal]

    subgraph Render["Render, plan gratuito"]
        FE[sgologic-frontend<br/>nginx con la aplicación React]
        BE[sgologic-backend<br/>Spring Boot]
    end

    NEON[(Neon<br/>PostgreSQL 16)]
    R2[(Cloudflare R2<br/>archivo del ERP)]

    U -- HTTPS --> FE
    FE -- "/api, por BACKEND_URL pública" --> BE
    BE -- DATABASE_URL --> NEON
    BE -- API compatible con S3 --> R2

    subgraph Local["Solo en docker-compose"]
        KAF{{Kafka}}
        PRV[Seis proveedores simulados]
    end
    BE -. no desplegado en la nube .-> KAF
    BE -. no desplegado en la nube .-> PRV
```
