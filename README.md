# Dynamic Survey

An AI-powered survey creation platform that guides you through a three-step workflow: define your survey configuration, generate a structured variable model, then produce a full question set—automatically. Powered by OpenRouter, the AI doesn't just generate questions; it evaluates them for quality, detects duplicates, checks readability, and auto-regenerates underperforming items. An integrated chat assistant lets you refine questions in plain language after generation.

Built for teams, the platform also supports user accounts, survey persistence with full version history, shareable links, and live multi-user collaboration over WebSockets.

## ✨ Key Features

- **Three-step AI workflow** — configure your survey, generate a structured variable model (dependent / driver / control), then stream-generate a validated question set
- **Intelligent question evaluation** — automatically scores questions for clarity, relevance, readability, duplicate similarity, and skip-logic correctness; auto-regenerates on failure
- **AI chat assistant** — refine, add, remove, reorder, or simplify questions through a natural-language chat interface
- **Survey flow visualization** — interactive node-graph view of your survey's branching logic, powered by React Flow
- **Question types** — Likert, Multiple Choice, Multi-Select, Yes/No, Open-Ended, and Rating scales, all with conditional branching
- **PDF import** — paste or upload a PDF and the AI extracts the survey configuration automatically
- **Authentication** — register/login with JWT-based sessions
- **Survey persistence** — save, edit, and manage surveys with `DRAFT` / `PUBLISHED` / `ARCHIVED` statuses
- **Version history** — every save creates a snapshot; restore any previous version at any time
- **Sharing** — generate shareable links with `VIEW` or `EDIT` permissions and optional expiry
- **Real-time collaboration** — live cursor tracking and survey sync over Socket.IO; authenticated users or guests can share a room
- **Multilingual** — full Arabic (RTL) and English support via i18next

## 🚀 Tech Stack

### 💻 Frontend

| Technology | Role |
|---|---|
| React 18 & Vite | UI framework and build tool |
| Tailwind CSS v3 | Utility-first styling |
| React Router v6 | Client-side routing |
| @xyflow/react | Interactive survey flow graph |
| Socket.IO Client | Real-time collaboration |
| i18next | Multilingual support (EN / AR) |
| Lucide React | Icon set |

### ⚙️ Backend

| Technology | Role |
|---|---|
| Node.js & Express.js | HTTP server |
| PostgreSQL & Prisma ORM | Relational data persistence |
| Socket.IO | WebSocket rooms and event broadcasting |
| JSON Web Tokens (JWT) | Authentication |
| bcrypt | Password hashing |
| pdf-parse | PDF text extraction |
| @xenova/transformers | Local embeddings for duplicate detection |
| OpenRouter API | LLM gateway (configurable model) |

## 🛠️ Getting Started

### Prerequisites

- Node.js 20.6+
- PostgreSQL database (local or hosted, e.g. Supabase, Neon, Railway) — **not needed for Docker**
- An [OpenRouter API key](https://openrouter.ai/keys)

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=moonshotai/kimi-k2.6:free
DATABASE_URL="postgresql://user:password@localhost:5432/dynamic_survey"
JWT_SECRET=a_long_random_secret_string
```

### 3. Run Database Migrations

```bash
cd server && npm run db:migrate
```

### 4. Start the Dev Server

```bash
npm run dev
```

This starts both the client (`http://localhost:5173`) and the API server (`http://localhost:4000`) concurrently. Vite proxies `/api` and `/socket.io` to the server in development.

---

## 🐳 Docker

The Docker setup is fully self-contained — PostgreSQL is included as a service. A two-stage Dockerfile compiles the React client at build time and serves everything from a single Express server. Database migrations run automatically on every container start.

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
POSTGRES_PASSWORD=changeme
JWT_SECRET=a_long_random_secret_string
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=moonshotai/kimi-k2.6:free
```

### 2. Start

```bash
docker compose up --build
```

That's it. Compose will:
1. Pull and start a PostgreSQL 16 container
2. Build the app image (React client + Express server)
3. Wait for Postgres to pass its healthcheck
4. Run `prisma migrate deploy` to apply any pending migrations
5. Start the server on **http://localhost:4000**

Data is persisted in a named Docker volume (`postgres_data`) so it survives container restarts.

### Subsequent starts (no code changes)

```bash
docker compose up
```

### Stop and remove containers

```bash
docker compose down
```

To also delete the database volume:

```bash
docker compose down -v
```

---

## 🔧 Environment Variables

### Docker (root `.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_USER` | No | `survey` | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password |
| `POSTGRES_DB` | No | `survey_db` | PostgreSQL database name |
| `JWT_SECRET` | Yes | — | Secret used to sign and verify JWT tokens |
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | _(empty)_ | Model to use via OpenRouter |
| `PORT` | No | `4000` | Host port mapped to the app container |

### Local dev (`server/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `moonshotai/kimi-k2.6:free` | Model to use via OpenRouter |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret used to sign and verify JWT tokens |

---

## 📡 API Overview

### Auth

| Method & Path | Description |
|---|---|
| `POST /api/auth/register` | Create a new user account |
| `POST /api/auth/login` | Authenticate and receive a JWT |
| `GET /api/auth/me` | Return the authenticated user |

### Surveys

| Method & Path | Description |
|---|---|
| `GET /api/surveys` | List all surveys for the authenticated user |
| `POST /api/surveys` | Create a new survey |
| `GET /api/surveys/:id` | Fetch a single survey |
| `PUT /api/surveys/:id` | Update survey metadata or content |
| `DELETE /api/surveys/:id` | Delete a survey |
| `GET /api/surveys/:id/versions` | List all saved versions |
| `POST /api/surveys/:id/versions` | Restore a version snapshot |
| `GET /api/surveys/:id/shares` | List active share links |
| `POST /api/surveys/:id/shares` | Create a share link (VIEW or EDIT, optional expiry) |
| `DELETE /api/surveys/:id/shares/:shareId` | Revoke a share link |
| `GET /api/surveys/:id/collaborators` | List collaborators |
| `GET /api/shared/:token` | Access a survey via a public share token |

### AI Generation

| Method & Path | Description |
|---|---|
| `POST /api/generate-variable-model` | Generate a variable model (dependent / driver / control) |
| `POST /api/generate-questions` | Generate and evaluate questions — streams progress via SSE |
| `POST /api/evaluate-questions` | Evaluate an existing question set |
| `POST /api/chat` | Chat assistant for natural-language survey editing |

### Utility

| Method & Path | Description |
|---|---|
| `GET /health` | Health check |
