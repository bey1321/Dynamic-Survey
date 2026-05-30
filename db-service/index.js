import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

import { initRealtime } from './services/realtime.js'
import authRoutes from './routes/auth.js'
import surveysRoutes from './routes/surveys.js'
import versionsRoutes from './routes/versions.js'
import sharesRoutes, { publicRouter as sharedPublicRouter } from './routes/shares.js'

const app = express()

// Socket.io must attach to the raw http server, not the express app directly
const httpServer = createServer(app)

const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

initRealtime(io)

// Allow requests from the Dynamic Survey frontend (port 5173 in dev)
app.use(cors())
app.use(express.json({ limit: '20mb' }))

// Health check — useful to confirm the service is running
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'survey-db-service' })
)

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ── Survey CRUD ───────────────────────────────────────────────────────────────
app.use('/api/surveys', surveysRoutes)

// ── Version history ───────────────────────────────────────────────────────────
app.use('/api/surveys/:id/versions', versionsRoutes)

// ── Share links ───────────────────────────────────────────────────────────────
app.use('/api/surveys/:id/shares', sharesRoutes)

// ── Public access via share token (no login required) ─────────────────────────
app.use('/api/shared', sharedPublicRouter)

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () =>
  console.log(`[survey-db-service] Running on http://localhost:${PORT}`)
)
