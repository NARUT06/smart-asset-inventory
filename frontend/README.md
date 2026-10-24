# AST Frontend — Smart Asset Inventory

React + Vite frontend, fully connected to the AST backend (Express + Prisma + PostgreSQL).

## 1) Run backend

```bash
cd ../ast-backend
npm install
cp .env.example .env   # set DATABASE_URL + JWT_SECRET(>=32 chars)
npx prisma migrate deploy
npm run dev            # http://localhost:5000
```

Backend CORS already allows `http://localhost:5173` (plus any `*.pages.dev` and `CLIENT_ORIGIN`).

Health: `GET http://localhost:5000/api/health`
Docs: `http://localhost:5000/api/docs`

## 2) Run frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Config: `.env` → `VITE_API_URL=http://localhost:5000`
Production: `VITE_API_URL=https://smart-asset-backend-production.up.railway.app`

```bash
npm run build
npm run preview
```

## 3) Auth & roles

- `POST /api/auth/login` → token saved to `localStorage (ast_token)` and sent as `Bearer`.
- First registered user becomes ADMIN (bootstrap), afterwards only ADMIN can `POST /api/auth/register`.
- Role gates in UI: Assets create (ADMIN/PROCUREMENT), status (ADMIN/CUSTODIAN), retire/delete (ADMIN), transfers (ADMIN/CUSTODIAN), work orders create (ADMIN/CUSTODIAN/TECHNICIAN), templates (ADMIN/PROCUREMENT), users edit (ADMIN), audit (ADMIN).

## 4) API coverage

| Page | Endpoints |
|---|---|
| Dashboard | `GET /api/dashboard/stats` |
| Assets | `GET/POST /api/assets`, `GET /api/assets/:id`, `PATCH /:id/status`, `PATCH /:id/retire`, `DELETE /:id`, `POST /:id/assess-risk`, `GET /:id/risk-history` |
| Categories | `GET/POST /api/categories`, `PUT/DELETE /:id` |
| Locations | `GET/POST /api/locations`, `GET /tree`, `GET /:id/children`, `PUT/DELETE /:id` |
| Transfers | `GET/POST /api/transfers`, `GET /asset/:assetId`, `GET /:id` |
| Work orders | `GET/POST /api/work-orders`, `GET /:id`, `PUT /:id`, `PATCH /:id/status`, `DELETE /:id`, `GET /asset/:assetId/summary` |
| Templates | `GET/POST /api/maintenance-templates` |
| Users | `POST /api/auth/register`, `GET /api/auth/users`, `PATCH /api/auth/users/:id`, `GET /api/auth/me`, `PATCH /api/auth/change-password` |
| Audit | `GET /api/admin/logs` |

Notes:
- Backend serializers expose `_id` (helpers `rid`/`rlabel` in `src/lib/api.js` handle both `_id` and `id`).
- Asset `locationId/custodianId` change only via `POST /api/transfers`; `UNDER_MAINTENANCE` is automatic via work orders.
- UI is bilingual AR (RTL default) / EN with a toggle persisted in `localStorage`.
