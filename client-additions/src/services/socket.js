/**
 * Socket.io client for real-time collaboration via the survey-db-service.
 * Connects to port 5000 — completely separate from the existing app on port 4000.
 *
 * How to use in a React component:
 *
 *   import { connectSocket, joinSurvey, leaveSurvey, getSocket, EVENTS } from './services/socket'
 *
 *   // 1. Connect once after login (e.g. in AuthContext or App.jsx)
 *   connectSocket(token)
 *
 *   // 2. In a survey page component:
 *   useEffect(() => {
 *     joinSurvey(surveyId)
 *     const socket = getSocket()
 *     socket.on(EVENTS.SURVEY_UPDATED, () => refetchSurvey())
 *     socket.on(EVENTS.ROOM_USERS,     (users) => setActiveUsers(users))
 *     return () => leaveSurvey(surveyId)
 *   }, [surveyId])
 *
 *   // 3. After saving to the db-service, notify others:
 *   await api.updateSurvey(id, { snapshot })
 *   emitSurveyUpdate(surveyId)
 */

import { io } from 'socket.io-client'

const DB_SERVICE_URL = import.meta.env.VITE_DB_SERVICE_URL || 'http://localhost:5000'

let socket = null

// ── Connection lifecycle ───────────────────────────────────────────────────────

export const connectSocket = (authToken) => {
  if (socket?.connected) return socket

  socket = io(DB_SERVICE_URL, {
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect',       () => console.log('[DB Socket] Connected:', socket.id))
  socket.on('disconnect',    (r) => console.log('[DB Socket] Disconnected:', r))
  socket.on('connect_error', (e) => console.warn('[DB Socket] Error:', e.message))

  return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}

// ── Room management ────────────────────────────────────────────────────────────

/** Call when opening a survey page. */
export const joinSurvey = (surveyId) => socket?.emit('join_survey', surveyId)

/** Call on component unmount or when navigating away from the survey. */
export const leaveSurvey = (surveyId) => socket?.emit('leave_survey', surveyId)

// ── Emitting events ────────────────────────────────────────────────────────────

/**
 * After saving a survey to the db-service, call this to notify all other
 * open tabs and collaborators so they reload automatically.
 */
export const emitSurveyUpdate = (surveyId, data = {}) =>
  socket?.emit('survey_updated', { surveyId, data })

/**
 * Broadcast cursor/focus position for collaborative presence.
 * position = { questionId, field } or any object you find useful.
 */
export const emitCursorMove = (surveyId, position) =>
  socket?.emit('cursor_move', { surveyId, position })

// ── Event name constants ───────────────────────────────────────────────────────
// Use these in socket.on() calls to avoid typos with raw strings.

export const EVENTS = {
  SURVEY_UPDATED: 'survey_updated', // another user saved a change
  ROOM_USERS:     'room_users',     // full updated list of who is in the room
  USER_JOINED:    'user_joined',    // a specific user just opened this survey
  USER_LEFT:      'user_left',      // a specific user closed or navigated away
  CURSOR_MOVE:    'cursor_move',    // another user's cursor/focus moved
}
