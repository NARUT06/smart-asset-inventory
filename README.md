# Smart Asset Inventory & Predictive Maintenance (AST)

Monorepo for the **AST** system — Faculty of AI & Data Management, Badr University in Assiut (BUA).

## Repository structure

```
.
├── ast-backend/        # Node.js + Express + Prisma + PostgreSQL API
├── frontend/           # React + Vite single-page app
├── render.yaml         # Render Blueprint for the backend
└── README.md
```

## Tech stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18, Vite 5, React Router, Axios |
| Backend   | Node.js, Express 4, Prisma 6 |
| Database  | PostgreSQL (Neon) |
| Auth      | JWT (Bearer tokens), RBAC (ADMIN, PROCUREMENT, CUSTODIAN, TECHNICIAN, AUDITOR) |
| Deploy    | Backend → Render · Frontend → Vercel |

## Local development

### 1. Backend

```bash
cd ast-backend
npm install
cp .env.example .env      # then edit .env (DATABASE_URL, JWT_SECRET, CLIENT_ORIGIN)
npx prisma migrate deploy
npm run dev               # http://localhost:5000
```

Health check: `GET http://localhost:5000/api/health`

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000
npm run dev               # http://localhost:5173
```

## Environment variables

### Backend (`ast-backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string (Neon) |
| `JWT_SECRET` | yes | At least 32 random characters |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `1d`) |
| `CLIENT_ORIGIN` | yes | Comma-separated allowed frontend origins |
| `PORT` | no | Defaults to `5000` |
| `NODE_ENV` | no | `production` on Render |
| `TRUST_PROXY` | no | Set to `1` behind Render's proxy |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Base URL of the backend API |

## Deployment

### Backend → Render

The repo ships a [`render.yaml`](./render.yaml) Blueprint.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, connect the repo, and apply.
3. Provide the two secret values when prompted:
   - `DATABASE_URL` — your Neon connection string.
   - `CLIENT_ORIGIN` — your Vercel URL, e.g. `https://your-app.vercel.app`.
4. Render builds with `npm install && npx prisma generate` and starts with
   `npx prisma migrate deploy && npm start`.

**Manual alternative** (New → Web Service):

| Setting | Value |
|---------|-------|
| Root Directory | `ast-backend` |
| Build Command | `npm install && npx prisma generate` |
| Start Command | `npx prisma migrate deploy && npm start` |
| Health Check Path | `/api/health` |

Environment variables: `NODE_ENV=production`, `TRUST_PROXY=1`, `JWT_SECRET`, `DATABASE_URL`, `CLIENT_ORIGIN`.

### Frontend → Vercel

1. Import this repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. Add environment variable `VITE_API_URL` = your Render service URL
   (e.g. `https://ast-backend.onrender.com`).
4. Deploy.

After the frontend URL is known, add it to the backend's `CLIENT_ORIGIN`
(Render → Environment) so CORS allows it.

## License

ISC
