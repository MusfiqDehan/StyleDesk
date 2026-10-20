# StyleDesk — Enterprise Multi-Tenant Salon, Spa & Barbershop Management SaaS

StyleDesk is an enterprise-grade, multi-tenant Software-as-a-Service (SaaS) platform built for salons, spas, and barbershops. Designed for multi-branch salon enterprises and independent studio owners, StyleDesk combines front-desk point of sale (POS), online customer appointment scheduling, ZKTeco biometric attendance hardware synchronization, employee payroll with automated commission calculation, real-time inventory tracking, financial bookkeeping, multi-gateway billing (Stripe & SSLCommerz), and white-labeled custom domain support.

The system enforces strict data isolation using **PostgreSQL 16 Row-Level Security (RLS)** in a shared-schema architecture, managed by NestJS and rendered with Next.js 16 App Router.

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [System Architecture (HLD)](#system-architecture-hld)
- [Entity-Relationship Diagram (ERD)](#entity-relationship-diagram-erd)
- [Class Diagram](#class-diagram)
- [Sequence Diagram (Request & Transaction Lifecycle)](#sequence-diagram-request--transaction-lifecycle)
- [Comprehensive Feature Matrix](#comprehensive-feature-matrix)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Local Development Setup](#local-development-setup)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Start Infrastructure (Postgres & Redis)](#3-start-infrastructure-postgres--redis)
  - [4. Database Roles & Migrations](#4-database-roles--migrations)
  - [5. Provisioning & Demo Data](#5-provisioning--demo-data)
  - [6. Start the Backend API](#6-start-the-backend-api)
  - [7. Start the Frontend Application](#7-start-the-frontend-application)
  - [8. Local Hosts Resolution](#8-local-hosts-resolution)
- [Production Deployment Guide](#production-deployment-guide)
  - [1. Domain & Wildcard TLS Configuration](#1-domain--wildcard-tls-configuration)
  - [2. Database Security & Least Privilege](#2-database-security--least-privilege)
  - [3. Container Orchestration](#3-container-orchestration)
  - [4. Payment Gateways & Webhooks](#4-payment-gateways--webhooks)
- [Testing & Quality Assurance](#testing--quality-assurance)

---

## Architectural Overview

StyleDesk operates across two distinct planes:

1. **Platform Plane (`styledesk.musfiqdehan.com` or `localhost:3000`)**:
   - Manages tenant businesses, subscription lifecycle, and billing tiers (Starter, Growth, Pro).
   - Manages gateway catalog integrations (Stripe, SSLCommerz) and tenant-level gateway policies.
   - Monitors custom domain verification (CNAME / Apex DNS) and platform audit trails.
   - Issues platform invitations, manages seat caps, and handles automated platform outbox notifications.

2. **Tenant Salon Plane (`<slug>.styledesk.musfiqdehan.com` or custom verified domain)**:
   - Dedicated salon portal serving both the customer-facing booking engine and staff back-office admin dashboard.
   - Operates with strict PostgreSQL Row-Level Security (RLS). Every query runs within an isolated database transaction carrying session variables `app.current_tenant_id` and `app.current_branch_id`.
   - Distinct scope tiers:
     - **Business-Owned**: Accounts, clients, services/packages, global brand settings, testimonials.
     - **Branch-Owned**: Appointments, POS transactions, inventory stock, staff attendance, payroll, cash registers, hardware devices.

---

## System Architecture (HLD)

```mermaid
flowchart TD
    subgraph Clients["Clients & Edge Devices"]
        BrowserPlatform["Platform Admin Browser<br/>(styledesk.example.com)"]
        BrowserTenant["Salon Customer & Staff<br/>(salon-a.example.com)"]
        ZkDevice["ZKTeco Biometric Device<br/>(TCP Port 4370 / Push API)"]
    end

    subgraph Edge["Edge & Ingress Layer"]
        Traefik["Traefik / Nginx Reverse Proxy<br/>(Wildcard SSL Termination & Subdomain Routing)"]
    end

    subgraph FrontendApp["Frontend Application (Next.js 16 App Router)"]
        NextServer["Next.js SSR & Server Components"]
        ApiProxy["Internal Proxy Route (/api/backend/*)"]
        ClientApp["Client Context & UI Views<br/>(React 19, Tailwind CSS, Radix UI)"]
    end

    subgraph BackendApp["Backend API (NestJS 12)"]
        TenancyMiddleware["Tenancy Middleware<br/>(Host-to-Tenant Resolution)"]
        AuthGuards["Auth & Role Guards<br/>(JWT Dual-Realm: Platform vs Tenant)"]
        AsyncLocalStorage["AsyncLocalStorage Scope<br/>(Tenant & Branch Context Binding)"]
        
        subgraph Services["Core Business Services"]
            PlatformSvc["Platform & Billing Service"]
            AppointmentSvc["Appointment Engine"]
            PosSvc["POS & Invoicing Service"]
            BiometricSvc["Biometric & Attendance Service"]
            PayrollSvc["Payroll & Commission Engine"]
            InventorySvc["Inventory Management"]
        end

        SocketGateway["Socket.IO WebSocket Gateway<br/>(Real-Time Attendance & Notifications)"]
    end

    subgraph Persistence["Storage & Caching Layer"]
        RedisCache[("Redis 7<br/>(Pub/Sub, Rate Limiting & Cache)")]
        PostgresDB[("PostgreSQL 16 (With Forced RLS)<br/>- styledesk_runtime (Restricted Role)<br/>- styledesk_platform (Platform Role)")]
    end

    subgraph External["External Integrations"]
        StripeApi["Stripe API & Webhooks"]
        SslCommerzApi["SSLCommerz Hosted Gateway"]
        SmtpServer["SMTP Mail Delivery"]
    end

    BrowserPlatform --> Traefik
    BrowserTenant --> Traefik
    ZkDevice --> Traefik
    
    Traefik -->|HTTP/HTTPS| NextServer
    Traefik -->|WebSocket /api/socket.io| SocketGateway
    Traefik -->|Push /iclock/*| TenancyMiddleware

    NextServer --> ClientApp
    ClientApp --> ApiProxy
    ApiProxy --> TenancyMiddleware

    TenancyMiddleware --> AsyncLocalStorage
    AsyncLocalStorage --> AuthGuards
    AuthGuards --> Services

    Services --> SocketGateway
    Services --> RedisCache
    Services --> PostgresDB

    PlatformSvc --> StripeApi
    PosSvc --> SslCommerzApi
    PlatformSvc --> SmtpServer
```

---

## Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    TENANT ||--o{ BRANCH : "has many"
    TENANT ||--o{ CLIENT : "owns"
    TENANT ||--o{ SERVICE : "defines"
    TENANT ||--o{ PLATFORM_ACCOUNT : "manages"
    TENANT ||--|| TENANT_SUBSCRIPTION : "subscribed to"
    TENANT ||--o{ TENANT_DOMAIN : "configures"
    
    PLATFORM_PACKAGE ||--o{ PLATFORM_PACKAGE_VERSION : "versions"
    PLATFORM_PACKAGE_VERSION ||--o{ TENANT_SUBSCRIPTION : "binds"

    BRANCH ||--o{ EMPLOYEE : "employs"
    BRANCH ||--o{ APPOINTMENT : "schedules"
    BRANCH ||--o{ INVOICE : "issues"
    BRANCH ||--o{ INVENTORY : "stocks"
    BRANCH ||--o{ ATTENDANCE : "logs"
    BRANCH ||--o{ PAYROLL : "disburses"
    BRANCH ||--o{ DEVICE : "binds"

    CLIENT ||--o{ APPOINTMENT : "books"
    CLIENT ||--o{ INVOICE : "billed on"

    EMPLOYEE ||--o{ APPOINTMENT : "performs"
    EMPLOYEE ||--o{ ATTENDANCE : "records"
    EMPLOYEE ||--o{ PAYROLL : "receives"
    EMPLOYEE ||--o{ LEAVE_REQUEST : "submits"

    INVOICE ||--o{ PAYMENT_ATTEMPT : "paid via"
    PAYMENT_ATTEMPT ||--o| PAYMENT_SETTLEMENT : "settles"

    TENANT {
        uuid id PK
        string slug UK
        string name
        boolean active
        timestamptz created_at
    }

    BRANCH {
        uuid id PK
        uuid tenant_id FK
        string name
        string address
        string phone
        boolean is_default
    }

    PLATFORM_PACKAGE {
        uuid id PK
        string slug UK
        int current_version
        boolean published
    }

    PLATFORM_PACKAGE_VERSION {
        uuid package_id PK,FK
        int version PK
        string name
        numeric monthly
        numeric yearly
        int staff_limit
        int customer_limit
        jsonb features
    }

    TENANT_SUBSCRIPTION {
        uuid tenant_id PK,FK
        uuid package_id FK
        int package_version FK
        string status
        timestamptz starts_at
        timestamptz ends_at
        timestamptz grace_until
    }

    EMPLOYEE {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        string name
        string email
        string designation
        numeric salary
        numeric commission_rate
    }

    CLIENT {
        uuid id PK
        uuid tenant_id FK
        string full_name
        string email
        string phone
        numeric total_spent
        numeric total_due
    }

    SERVICE {
        uuid id PK
        uuid tenant_id FK
        string name
        numeric price
        int duration_minutes
        string category
    }

    APPOINTMENT {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        uuid client_id FK
        uuid employee_id FK
        uuid service_id FK
        timestamptz start_time
        timestamptz end_time
        string status
    }

    INVOICE {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        uuid client_id FK
        string invoice_number
        numeric total_amount
        numeric paid_amount
        numeric due_amount
        string status
    }

    PAYMENT_ATTEMPT {
        uuid id PK
        string tran_id UK
        uuid tenant_id FK
        string gateway_slug
        numeric amount
        string currency
        string status
    }

    ATTENDANCE {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        uuid employee_id FK
        date date
        timestamptz check_in
        timestamptz check_out
        string status
    }

    DEVICE {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        string serial_number UK
        string ip_address
        string secret_key
        boolean active
    }
```

---

## Class Diagram

```mermaid
classDiagram
    class TenancyMiddleware {
        +use(req, res, next)
        -resolveTenantFromHost(host)
        -bindAsyncLocalStorage(tenantId, branchId)
    }

    class ScopedDataSource {
        +createQueryRunner()
        +getScopedEntityManager()
        +setSessionContext(tenantId, branchId)
    }

    class JwtAuthGuard {
        +canActivate(context)
        -validateTokenVersion(payload)
        -enforceRealmIsolation(req, payload)
    }

    class PermissionsGuard {
        +canActivate(context)
        -resolveAccountPermissions(accountId)
        -matchRequiredPermissions(reflector)
    }

    class AppointmentsController {
        +create(dto: CreateAppointmentDto)
        +findAll(query: FilterAppointmentDto)
        +updateStatus(id: string, status: string)
        +findAvailableSlots(date: string, staffId: string)
    }

    class AppointmentsService {
        -scopedRepo: Repository~Appointment~
        +bookAppointment(dto)
        +reschedule(id, newSlot)
        +validateSlotConflict(branchId, staffId, slot)
    }

    class InvoiceController {
        +create(dto: CreateInvoiceDto)
        +recordPayment(id: string, paymentDto)
        +generatePdfReceipt(id: string)
    }

    class InvoiceService {
        -invoiceRepo: Repository~Invoice~
        -paymentRepo: Repository~PaymentAttempt~
        +generateInvoice(orderData)
        +applyDiscounts(code, amount)
        +processSettlement(attemptId)
    }

    class ZktecoService {
        -deviceRepo: Repository~Device~
        +connectDevice(ip, port)
        +syncAttendanceLogs(deviceId)
        +handleBiometricPushPunch(payload, key)
    }

    class PaymentsService {
        -gatewayCatalog: Map~string, GatewayAdapter~
        +initiatePayment(source, amount, gateway)
        +handleWebhook(gateway, payload, signature)
        +verifySession(transactionId)
    }

    TenancyMiddleware --> ScopedDataSource : initializes session
    JwtAuthGuard --> PermissionsGuard : precedes
    AppointmentsController --> AppointmentsService : delegates
    InvoiceController --> InvoiceService : delegates
    InvoiceService --> PaymentsService : triggers online payment
    AppointmentsService --> ScopedDataSource : executes scoped RLS queries
    InvoiceService --> ScopedDataSource : executes scoped RLS queries
    ZktecoService --> ScopedDataSource : saves attendance logs
```

---

## Sequence Diagram (Request & Transaction Lifecycle)

The following diagram illustrates how an authenticated booking or POS checkout request flows through the entire system:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Salon Client / Frontdesk Staff
    participant NextProxy as Next.js Proxy (/api/backend)
    participant TenancyMW as Tenancy Middleware
    participant ALS as AsyncLocalStorage Context
    participant Guard as JWT & Permissions Guard
    participant Controller as Appointments / Invoice Controller
    participant Service as Business Domain Service
    participant TypeORM as Scoped TypeORM DataSource
    participant Postgres as PostgreSQL 16 (With RLS)
    participant Socket as Socket.IO Gateway

    Customer->>NextProxy: POST /api/backend/appointments (Host: salon-a.styledesk.com)
    NextProxy->>TenancyMW: Forward request with Host header & cookies

    TenancyMW->>Postgres: Resolve tenant by domain (Security-Definer lookup)
    Postgres-->>TenancyMW: Returns tenant UUID & settings
    TenancyMW->>ALS: Enter context (tenant_id = salon-a, branch_id = b1)

    ALS->>Guard: Verify JWT Access Token
    Guard->>Guard: Check tenantId match, tokenVersion & expiration
    Guard-->>Controller: Context authorized

    Controller->>Service: bookAppointment(CreateAppointmentDto)
    Service->>TypeORM: Start Transaction with tenant scope

    TypeORM->>Postgres: SET LOCAL app.current_tenant_id = 'salon-a-uuid';
    TypeORM->>Postgres: SET LOCAL app.current_branch_id = 'branch-1-uuid';
    
    TypeORM->>Postgres: INSERT INTO appointments (...) RETURNING *;
    Note over Postgres: PostgreSQL RLS verifies tenant_id matches.<br/>Rejects cross-tenant records automatically.
    Postgres-->>TypeORM: Appointment created successfully

    TypeORM->>Postgres: COMMIT Transaction;
    Service->>Socket: Emit 'appointment:created' event to branch room
    Socket-->>Customer: Broadcast real-time schedule update
    Service-->>Controller: Return formatted appointment record
    Controller-->>NextProxy: HTTP 201 Created
    NextProxy-->>Customer: JSON Response with Appointment Confirmation
```

---

## Comprehensive Feature Matrix

### 1. Multi-Tenant Architecture & Data Isolation
- **Row-Level Security (RLS)**: Forced at the database level on all branch and business tables. Zero data leakage across tenants.
- **Dynamic Host Resolution**: Resolves tenant profiles via subdomain or verified custom domain names.
- **Fail-Closed Security**: Missing, unknown, or suspended tenants terminate requests immediately with standard 404/403 responses.
- **AsyncLocalStorage Isolation**: Per-request transaction binding that prevents cross-tenant context leaks during concurrent execution.

### 2. Platform Administration & Subscriptions
- **Tiers & Packaging**: Granular seat caps (staff and client limits), duration, trial periods, and feature flags.
- **Package Versioning**: Non-destructive, immutable version snapshots protect existing subscribed tenants from breaking changes.
- **Platform Outbox**: Queued email dispatching for invitations, password resets, and subscription alerts.
- **Audit Trails**: Detailed before-and-after change logging for all administrative platform adjustments.

### 3. Salon Frontdesk & Point of Sale (POS)
- **Fast POS Interface**: Designed for high-volume counter transactions. Quick-select services and retail products.
- **Cart & Discount Engine**: Custom discounts, loyalty points, and promo vouchers with real-time tax and tip computation.
- **Dues & FIFO Settlement**: Tracks client dues and enables partial settlements with automated chronological due clearance.
- **Receipt Printing**: Thermal receipt and full invoice PDF generation using client-side jsPDF with branded templates.

### 4. Appointment Booking & Online Scheduling
- **Multi-Step Customer Portal**: Public booking flow with real-time slot calculation, specialist selection, and automated confirmations.
- **Double-Booking Prevention**: High-concurrency slot validation ensures stylists cannot be double-booked across services.
- **Calendar & Timeline View**: Drag-and-drop daily and weekly views organized by staff, station, and branch.

### 5. Hardware Biometric Attendance (ZKTeco)
- **Direct Integration**: Native TCP communication (`node-zklib`) on port 4370 and HTTP push protocol (`/iclock/*`).
- **Hardware Agnostic**: Supports push-based biometric clocks and scheduled polling of network-attached terminals.
- **Offline Resiliency**: Queues punch logs during device network drops and backfills attendance chronologically.

### 6. Employee & Automated Payroll Engine
- **Flexible Compensation**: Supports fixed base salaries, tiered service commissions, and retail product incentives.
- **Attendance-Based Adjustments**: Auto-calculates deductions, overtime hours, and leave balances directly from biometric logs.
- **Payslip Generation**: Generates printable PDF salary statements with breakdown of earnings, deductions, and commissions.

### 7. Inventory & Supply Chain
- **Stock Tracking**: Monitors retail merchandise and salon-use back-bar supplies.
- **Low-Stock Alerts**: Automated dashboard alerts when inventory dips below minimum reorder thresholds.
- **Automated Depletion**: Deducts inventory automatically when services with consumable supplies are completed.

### 8. Financial Accounting & Multi-Branch Reports
- **Income & Expense Tracking**: Categorized revenue and operational expenditures per branch.
- **Executive Dashboards**: Real-time sales summaries, staff performance KPIs, customer retention rates, and profit & loss projections.
- **Aggregated View**: Business owners can review all-branch aggregated performance or isolate single branch branches.

### 9. Multi-Gateway Payment Processing
- **Dual Gateway Adapters**: Native support for Stripe and SSLCommerz.
- **Encrypted Credentials**: Merchant secrets are symmetrically encrypted using AES-256 (`PAYMENT_ENCRYPTION_KEY`).
- **Webhook Reconciliation**: Cryptographically verified webhook handlers with idempotent transaction settlement.

### 10. Custom Domain & White-Labeling
- **Custom Vanity Domains**: Tenants can point their own domains (e.g., `booking.luxuryhairsalon.com`) using CNAME verification.
- **Dynamic Theming**: Custom brand colors, primary logo, inverse logo, and favicon injected per tenant host.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | [NestJS 12](https://nestjs.com/) (Node.js 22 LTS, TypeScript) |
| **ORM & Database** | [TypeORM](https://typeorm.io/) on [PostgreSQL 16](https://www.postgresql.org/) with Row-Level Security (RLS) |
| **Caching & Pub/Sub** | [Redis 7](https://redis.io/) via `ioredis` & `cache-manager` |
| **Real-Time WebSockets**| [Socket.IO](https://socket.io/) (authenticated multi-tenant rooms) |
| **Hardware Biometric** | `node-zklib` (ZKTeco protocol integration) |
| **Authentication** | [Passport.js](http://www.passportjs.org/) + JWT (Dual realm: Platform & Tenant) |
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server Actions, React 19) |
| **Styling & UI Kit** | [Tailwind CSS 3](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) |
| **PDF Generation** | `jspdf` & `jspdf-autotable` |
| **Containerization** | Docker, Docker Compose, Multi-stage builds |

---

## Repository Structure

```
StyleDesk/
├── backend/                         # NestJS API Application
│   ├── Dockerfile                   # Multi-stage production Docker build
│   ├── docker-compose.local.yml     # Local dev compose (Postgres 16, Redis 7, NestJS)
│   ├── docker-compose.prod.yml      # Production compose specification
│   ├── migrations/                  # TypeORM migrations (Baseline schema, RLS policies)
│   ├── scripts/                     # Operational scripts (provisioning, seed, bootstrap)
│   └── src/
│       ├── appointments/            # Appointment booking & scheduling
│       ├── attendance/              # Attendance tracking & punch logs
│       ├── auth/                    # Authentication guards, JWT strategies, roles
│       ├── biometric/               # ZKTeco hardware library & push handler
│       ├── clients/                 # Customer directory & due tracking
│       ├── employee/                # Staff directory & commission rates
│       ├── finance/                 # Expense & revenue bookkeeping
│       ├── inventory/               # Product catalog & stock levels
│       ├── invoice/                 # Invoicing, billing & POS transactions
│       ├── payroll/                 # Salary calculation & payslip issuance
│       ├── platform/                # Platform control plane & subscriptions
│       ├── tenancy/                 # RLS entity listeners, middleware, AsyncLocalStorage
│       ├── app.module.ts            # Root application module
│       └── main.ts                  # NestJS bootstrap entrypoint
│
└── frontend/                        # Next.js 16 Client & Admin Application
    ├── Dockerfile                   # Standalone Next.js production build
    ├── docker-compose.local.yml     # Local dev compose for frontend
    ├── docker-compose.prod.yml      # Production frontend compose
    ├── app/
    │   ├── (platform)/              # Platform landing page, pricing, and registration
    │   ├── admin/                   # Back-office admin dashboard & POS terminal
    │   ├── appointments/            # Customer-facing online appointment booking
    │   ├── services/                # Public salon service catalog
    │   └── layout.tsx               # Root application layout
    ├── components/
    │   ├── admin/                   # POS registers, charts, tables, modals
    │   ├── ui/                      # Radix UI primitive design system
    │   └── biometric/               # Biometric hardware configuration modals
    ├── hooks/                       # Custom React hooks (debounce, sockets, toast)
    ├── lib/                         # Utility helpers, tenant fetchers, branding
    └── public/                      # Static assets, brand logos, hero banners
```

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: `v22.x` or higher
- **Package Managers**: `npm` (v10+)
- **Docker**: Engine 24+ and Docker Compose v2+

### 2. Environment Configuration

Copy the example environment files for both backend and frontend:

```bash
# In backend directory
cp backend/.env.example backend/.env

# In frontend directory
cp frontend/.env.example frontend/.env
```

Ensure the following variables are present in `backend/.env`:
```ini
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://styledesk_runtime:runtime_pass@localhost:5433/styledesk_tenancy
MIGRATION_DATABASE_URL=postgresql://postgres:operator_pass@localhost:5433/styledesk_tenancy
PLATFORM_DATABASE_URL=postgresql://styledesk_platform:platform_pass@localhost:5433/styledesk_tenancy
REDIS_HOST=localhost
REDIS_PORT=6380
JWT_SECRET=super-secret-jwt-key-change-in-prod-minimum-32-chars
PLATFORM_JWT_SECRET=super-secret-platform-jwt-key-minimum-32-chars
PAYMENT_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
TENANT_BASE_DOMAIN=localhost
PLATFORM_HOST=localhost
PLATFORM_PUBLIC_URL=http://localhost:3000
PUBLIC_URL_SCHEME=http
PUBLIC_URL_PORT=3000
```

### 3. Start Infrastructure (Postgres & Redis)

Start the local isolated database and cache containers:

```bash
cd backend
docker network create StyleDesk-dev 2>/dev/null || true
docker compose -f docker-compose.local.yml up -d StyleDesk-postgres-dev StyleDesk-redis-dev
```

*PostgreSQL will be accessible on `localhost:5433` and Redis on `localhost:6380`.*

### 4. Database Roles & Migrations

The database requires distinct roles to enforce Row-Level Security:

1. Connect to PostgreSQL using an operator shell:
   ```bash
   PGPASSWORD=operator_pass psql -h localhost -p 5433 -U postgres -d styledesk_tenancy
   ```

2. Create the unprivileged runtime and platform roles:
   ```sql
   CREATE ROLE styledesk_runtime LOGIN PASSWORD 'runtime_pass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
   CREATE ROLE styledesk_platform LOGIN PASSWORD 'platform_pass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
   \q
   ```

3. Run migrations and assign least-privilege table grants:
   ```bash
   cd backend
   npm ci --legacy-peer-deps
   npm run build
   RUNTIME_DATABASE_ROLE=styledesk_runtime PLATFORM_DATABASE_ROLE=styledesk_platform npm run db:migrate
   ```

### 5. Provisioning & Demo Data

Bootstrap the platform superadmin and demo tenant accounts:

```bash
# Bootstrap Platform Superadmin
PLATFORM_ADMIN_EMAIL=superadmin@styledesk.test PLATFORM_ADMIN_PASSWORD=StyleDeskDemo!2026 npm run platform:bootstrap

# Seed Demo Salon Tenants (creates client1 and client2 with 30-day trial)
NODE_ENV=development npm run seed:demo
```

### 6. Start the Backend API

```bash
cd backend
npm run start:dev
```
*API will listen on `http://localhost:4000` (Healthcheck: `http://localhost:4000/health`).*

### 7. Start the Frontend Application

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
*Frontend will listen on `http://localhost:3000`.*

### 8. Local Hosts Resolution

To test tenant subdomains locally, add the following entries to your `/etc/hosts` file (or `C:\Windows\System32\drivers\etc\hosts` on Windows):

```
127.0.0.1 localhost
127.0.0.1 styledesk.localhost
127.0.0.1 client1.localhost
127.0.0.1 client2.localhost
```

#### Default Development Credentials

| Portal | URL | Email | Password |
| :--- | :--- | :--- | :--- |
| **Platform Console** | `http://localhost:3000/admin` | `superadmin@styledesk.test` | `StyleDeskDemo!2026` |
| **Salon A Admin** | `http://client1.localhost:3000/admin` | `admin@client1.test` | `StyleDeskDemo!2026` |
| **Salon B Admin** | `http://client2.localhost:3000/admin` | `admin@client2.test` | `StyleDeskDemo!2026` |

---

## Production Deployment Guide

### 1. Domain & Wildcard TLS Configuration

Production deployments require a wildcard DNS entry pointing to the reverse proxy ingress:

```dns
styledesk.example.com.        IN A     <SERVER_PUBLIC_IPV4>
*.styledesk.example.com.      IN A     <SERVER_PUBLIC_IPV4>
```

#### Traefik Configuration Example
Traefik can manage wildcard TLS using Let's Encrypt DNS-01 challenges:
```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      dnsChallenge:
        provider: cloudflare
      email: certs@styledesk.example.com
      storage: /acme.json
```

### 2. Database Security & Least Privilege

> [!IMPORTANT]
> The running API (`styledesk_runtime` role) must **never** own the database schema, must **never** possess `SUPERUSER` privileges, and must **never** possess `BYPASSRLS`.

1. **Separation of Concerns**:
   - `postgres` (or dedicated operator role) executes migrations, alters tables, and defines security-definer directory functions.
   - `styledesk_runtime` possesses only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on tenant business tables under forced RLS.
   - `styledesk_platform` possesses access only to platform tables (`platform_package`, `tenant_subscription`, `gateway_catalog`, etc.).
2. **Forced RLS**:
   All tenant-owned tables enforce RLS:
   ```sql
   ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
   ```
3. **Encryption Key**:
   Generate a cryptographic 64-hex key for stored gateway credentials and store securely in a secret vault:
   ```bash
   openssl rand -hex 32
   ```

### 3. Container Orchestration

Deploy using the production Compose configuration:

```bash
# 1. Pull / Build images
docker compose -f backend/docker-compose.prod.yml build
docker compose -f frontend/docker-compose.prod.yml build

# 2. Run Database Migrations in an operator container
docker compose -f backend/docker-compose.prod.yml run --rm \
  -e MIGRATION_DATABASE_URL="postgresql://operator:secret@postgres:5432/styledesk_tenancy" \
  StyleDesk-server-prod npm run db:migrate

# 3. Start Production Services
docker compose -f backend/docker-compose.prod.yml up -d
docker compose -f frontend/docker-compose.prod.yml up -d
```

### 4. Payment Gateways & Webhooks

Configure webhook listening endpoints at your payment providers:

- **Platform Subscription Webhook (Stripe)**:
  `https://styledesk.example.com/api/backend/platform/payments/webhooks/stripe`
  *Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.*
- **Tenant Salon Invoice Webhook (Stripe)**:
  `https://client1.styledesk.example.com/api/backend/payments/webhooks/stripe`
- **SSLCommerz IPN (Instant Payment Notification)**:
  `https://styledesk.example.com/api/backend/platform/payments/webhooks/sslcommerz`

---

## Testing & Quality Assurance

StyleDesk includes an automated verification test suite:

```bash
# Run unit & authentication regression tests
cd backend
npm test -- --runInBand

# Run tenancy data-isolation tests (verifies RLS against PostgreSQL)
node scripts/test-tenancy.cjs

# Run API end-to-end tenancy tests
node scripts/test-api-tenancy.cjs

# Run platform subscription & payments simulation test
node scripts/test-platform.cjs
node scripts/test-platform-payments.cjs

# Run frontend cache isolation check
cd ../frontend
node scripts/security-cache-check.cjs
```

---

## License

This project is proprietary and confidential. All rights reserved. Unauthorized copying, modification, or distribution is strictly prohibited.

