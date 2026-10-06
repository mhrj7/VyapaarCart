# VyapaarCart — Multi-vendor Marketplace for Independent Sellers

**VyapaarCart** is a robust, multi-vendor e-commerce platform designed for small and independent sellers (Think: Amazon Marketplace + Seller Dashboard). Built with a modern, event-driven backend, the platform enables sellers to seamlessly manage inventory, list products, and fulfill orders while offering buyers a smooth storefront experience.

At its core, VyapaarCart handles high-concurrency inventory reservation, safe payment processing via idempotency, and asynchronous order workflows using a transactional outbox pattern to prevent overselling. 

## 🚀 Product Overview

- **Buyers**: Browse products, search, add items to cart, secure checkout, and track orders.
- **Sellers**: Create stores, manage product listings/SKUs, upload images, manage multi-warehouse inventory, process orders, and view sales metrics.
- **Admins**: Approve sellers, review products, manage disputes, refunds, calculate platform commissions, and monitor system health.

## 🏗️ Architecture

VyapaarCart is built as a **Modular Monolith** using Python and FastAPI, designed to seamlessly evolve into microservices as the product scales.

```mermaid
flowchart TD
    subgraph Frontend
        BuyerUI[Buyer Storefront - Next.js]
        SellerUI[Seller Dashboard - Next.js]
        AdminUI[Admin Portal - Next.js]
    end

    subgraph API Gateway / Auth
        FastAPI[VyapaarCart API Gateway & Core Modules]
        Auth[JWT Authentication & Role Auth]
    end

    subgraph Backend Modules
        Identity[Identity & Onboarding]
        Catalog[Catalog & Search]
        Inventory[Inventory Reservation]
        Order[Order Management]
        Payment[Payment Gateway Abstraction]
    end

    subgraph Infrastructure
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis)]
        Broker{Kafka / Redpanda}
        Storage[S3 / MinIO Object Storage]
    end

    BuyerUI --> FastAPI
    SellerUI --> FastAPI
    AdminUI --> FastAPI
    
    FastAPI --> Auth
    FastAPI --> Identity & Catalog & Inventory & Order & Payment
    
    Identity & Catalog & Inventory & Order & Payment --> PostgreSQL
    Catalog & Inventory & Auth --> Redis
    
    Order -- Transactional Outbox --> Broker
    Broker --> WebhookDelivery[Webhook / Event Delivery Workers]
    
    Catalog --> Storage
```

## 🛠️ Technology Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **Cache & Rate Limiting:** Redis
- **Message Broker:** Kafka or Redpanda
- **Object Storage:** MinIO / AWS S3
- **Containerization:** Docker & Docker Compose
- **Testing:** Pytest (Backend), Playwright (E2E)
- **Observability:** OpenTelemetry, Prometheus, Grafana, Loki (Structured Logs)
- **CI/CD:** GitHub Actions

## 🌊 Event Flow: Checkout & Order Creation

The core checkout process utilizes idempotency, inventory reservation, and a transactional outbox to ensure data consistency.

```mermaid
sequenceDiagram
    participant Buyer
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    participant Broker as Redpanda / Kafka
    
    Buyer->>API: POST /checkout (with Idempotency Key)
    API->>DB: Reserve Inventory (Row-level lock / Expiry)
    DB-->>API: Reservation Success
    API->>API: Process Payment (Mock/Stripe)
    API->>DB: BEGIN TRANSACTION
    API->>DB: Update Inventory (Confirm Stock)
    API->>DB: Create Order Record
    API->>DB: Insert Event to Outbox (order.created)
    API->>DB: COMMIT TRANSACTION
    API-->>Buyer: 201 Created (Order ID)
    
    DB->>Broker: Async Outbox Relay
    Broker->>API: Consume 'order.created'
    API->>API: Notify Seller & Dispatch Webhooks
```

## 📊 Database Schema (Core Modules)

```mermaid
erDiagram
    USERS ||--o{ STORES : manages
    STORES ||--o{ PRODUCTS : lists
    PRODUCTS ||--o{ SKUS : contains
    SKUS ||--o{ INVENTORY : stocked_in
    USERS ||--o{ ORDERS : places
    ORDERS ||--o{ ORDER_ITEMS : contains
    SKUS ||--o{ ORDER_ITEMS : included_in

    USERS {
        int id PK
        string email
        string hashed_password
        enum role "buyer, seller, admin"
    }
    STORES {
        int id PK
        int owner_id FK
        string name
        boolean is_approved
    }
    PRODUCTS {
        int id PK
        int store_id FK
        string title
        string description
    }
    SKUS {
        int id PK
        int product_id FK
        string sku_code
        decimal price
    }
    INVENTORY {
        int id PK
        int sku_id FK
        int quantity_available
        int quantity_reserved
    }
    ORDERS {
        int id PK
        int buyer_id FK
        string status
        decimal total_amount
    }
```

## 📦 Local Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/mhrj7/VyapaarCart.git
   cd VyapaarCart
   ```

2. **Start the core infrastructure (PostgreSQL, Redis, Redpanda, MinIO)**
   ```bash
   docker compose up -d
   ```

3. **Set up the Python environment**
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Run Database Migrations**
   ```bash
   alembic upgrade head
   ```

5. **Start the API Server**
   ```bash
   uvicorn src.api.main:app --reload
   ```

6. **Start the Background Worker** (For outbox processing and webhook delivery)
   ```bash
   python -m src.workers.event_dispatcher
   ```

## 📚 API Documentation

Once the server is running locally, navigate to the auto-generated Swagger UI:
- **Swagger / OpenAPI Specs**: `http://localhost:8000/docs`

## 🧪 Test Strategy

- **Unit Tests**: Isolated testing of business logic (e.g., cart total calculation, role checks).
- **Integration Tests**: `pytest` combined with `testcontainers` for real database and Redis interactions. Validates inventory locking, rate limiting, and transactional outbox inserts.
- **E2E Tests**: Playwright scripts simulating complete user journeys (Buyer checkout, Seller onboarding).

## 📈 Load Testing & Metrics

Load tests are executed using `k6` to stress test the inventory reservation and checkout endpoints to ensure that overselling is impossible under high concurrency. 

*(Note: Actual metrics will be published here once the V1 benchmark is executed on the CI pipeline.)*

## 🚢 Production Deployment Plan

- **Infrastructure as Code**: Terraform to provision AWS resources.
- **Compute**: FastAPI and Worker processes deployed as containers on AWS ECS (Fargate).
- **Database**: Amazon RDS for PostgreSQL (Multi-AZ for high availability).
- **Cache**: Amazon ElastiCache (Redis).
- **Events**: Amazon MSK (Managed Kafka) or Confluent Cloud.
- **Storage**: Amazon S3 for product images.
- **CI/CD**: GitHub Actions pipeline covering linting, testing, Docker image build, and ECS rolling deployments.

## ⚠️ Known Limitations & Next Steps

- **Webhook Infrastructure**: The webhook delivery mechanism (retries, DLQ, replay) currently resides within the VyapaarCart monolith.
- **Next Step**: Extract the webhook delivery and event management system into an independent SaaS project called **HookRelay** to provide dedicated webhook infrastructure.
- **Search**: Currently relies on standard SQL queries. Will integrate Elasticsearch or Typesense for advanced product discovery and filtering.

---
*Built as a scalable, high-performance portfolio project.*
