# HookRelay — Webhook Infrastructure for SaaS Products

HookRelay is a developer-facing SaaS platform that allows companies to easily create, manage, and dispatch webhook events (e.g., `order.created`, `payment.failed`, `user.invited`) reliably to their customers. 

When your system needs to publish an event, you send it to HookRelay once. HookRelay guarantees at-least-once delivery, handles exponential backoff, rate limiting, duplicate events, and provides a dead-letter queue (DLQ) for failed deliveries. It features a complete transactional outbox architecture utilizing Kafka/Redpanda.

## 🚀 Features

- **Organization & Environment Management**: Create orgs, projects, and environments (Test/Production).
- **Endpoint Subscriptions**: Customers can create webhook endpoints and subscribe to specific events.
- **Reliable Delivery**: At-least-once delivery semantics powered by Kafka/Redpanda.
- **Idempotency & Retry Policies**: Support for idempotency keys and automatic exponential backoff for failing endpoints.
- **Transactional Outbox**: Guarantees that internal database transactions and event publishing are atomically linked.
- **Security**: HMAC webhook signatures and API key management with secret rotation.
- **Rate Limiting**: Endpoint-level rate limiting to prevent overwhelming customer servers.
- **Audit & Replay**: Inspect delivery logs, response times, and failure reasons. One-click replay for failed deliveries.
- **Observability**: Built-in OpenTelemetry tracing, Prometheus metrics, and Grafana dashboards.

## 🏗️ Architecture

```text
Client → FastAPI API → PostgreSQL (Transactional Outbox)
                         ↓
                    Kafka / Redpanda
                         ↓
         Delivery workers → Customer Webhook Endpoint
                         ↓
          Retries / DLQ / Replay / Audit Dashboard
```

## 🛠️ Technology Stack

- **Language:** Python 3.11+
- **API Framework:** FastAPI, Pydantic
- **Database:** PostgreSQL, SQLAlchemy, Alembic (Migrations)
- **Message Broker:** Kafka / Redpanda
- **Caching & Rate Limiting:** Redis
- **Containerization:** Docker & Docker Compose
- **Observability:** OpenTelemetry, Prometheus, Grafana, Loki, Tempo
- **Testing:** Pytest, Testcontainers, k6 (Load Testing)
- **CI/CD:** GitHub Actions
- **Infrastructure as Code:** Terraform + AWS ECS/Fargate (or Kubernetes + Helm)

## 📦 Getting Started (Local Development)

### Prerequisites
- Docker & Docker Compose
- Python 3.11+

### Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/HookRelay.git
   cd HookRelay
   ```

2. **Start the infrastructure (PostgreSQL, Redis, Redpanda, Grafana)**
   ```bash
   docker-compose up -d
   ```

3. **Install dependencies**
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

6. **Start the Delivery Worker**
   ```bash
   python -m src.workers.delivery_worker
   ```

## 🧪 Testing

Run the test suite using `pytest` (utilizes Testcontainers for spinning up disposable PostgreSQL/Kafka instances):

```bash
pytest
```

## 📋 Roadmap & Implementation Details

- [x] Initial project setup and architecture design
- [ ] Implement Organization & API Key models
- [ ] Build Transactional Outbox pattern with SQLAlchemy
- [ ] Integrate Redpanda/Kafka producer
- [ ] Build the Delivery Worker (consumers, HTTP dispatcher)
- [ ] Implement HMAC signing for webhook payloads
- [ ] Add exponential backoff and DLQ logic
- [ ] Integrate Redis rate-limiting
- [ ] Set up OpenTelemetry, Loki, and Grafana

## 📄 License

This project is licensed under the MIT License.
