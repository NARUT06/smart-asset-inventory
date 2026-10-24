# AST Backend

Smart Asset Inventory & Predictive Maintenance System - Badr University
Node.js + Express + PostgreSQL (Prisma ORM), JWT auth, RBAC.

## Run

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then edit DATABASE_URL and JWT_SECRET (32+ chars)
npx prisma migrate dev --name init   # creates the tables (use `npm run prisma:deploy` in production)
npm run dev
```

IDs are auto-increment integers (`/api/assets/42`). The JSON shape of every response is unchanged (`_id`, populated references, nested `procurement`).

Bootstrap: the first `POST /api/auth/register` (no token) creates the ADMIN. After that only an ADMIN can register users.

## Roles

| Role | Can do |
|---|---|
| ADMIN | Everything |
| PROCUREMENT | Create/edit assets + categories |
| CUSTODIAN | Transfer own assets, report corrective work orders, set status of own assets |
| TECHNICIAN | Work on assigned/unassigned work orders |
| AUDITOR | Read-only |

## Endpoints (all under /api, JWT required except register-bootstrap and login)

| Area | Endpoints |
|---|---|
| Auth | POST /auth/register, POST /auth/login, GET /auth/me, PATCH /auth/change-password, GET /auth/users, PATCH /auth/users/:id |
| Categories | GET/POST /categories, GET/PUT/DELETE /categories/:id |
| Locations | GET/POST /locations, GET /locations/tree, GET/PUT/DELETE /locations/:id, GET /locations/:id/children |
| Assets | GET/POST /assets, GET/PUT/DELETE /assets/:id, PATCH /assets/:id/status |
| Transfers (append-only) | GET/POST /transfers, GET /transfers/:id, GET /transfers/asset/:assetId |
| Work orders | GET/POST /work-orders, GET/PUT/DELETE /work-orders/:id, PATCH /work-orders/:id/status, GET /work-orders/asset/:assetId/summary |

Useful filters: `/assets?status=&categoryId=&locationId=&q=&mine=true&warrantyExpiringInDays=30`, `/work-orders?overdue=true&dueBefore=2026-12-31`.
