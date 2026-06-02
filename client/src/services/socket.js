/**
 * Socket.io client for real-time collaboration.
 *
 * Usage:
 *   connectSocket(token)          // after login
 *   joinSurvey(surveyId)          // when opening a survey page
 *   socket.on(EVENTS.SURVEY_UPDATED, () => refetchSurvey())
 *   leaveSurvey(surveyId)         // on component unmount
 */

import { io } from 'socket.io-client'

// In dev, Vite proxies /socket.io to the Express server on 4000.
// In production, the server and client are on the same origin.
const SERVER_URL = import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin

let socket = null

export const connectSocket = (authToken) => {
  if (socket?.connected) return socket

  socket = io(SERVER_URL, {
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect',       () => console.log('[Socket] Connected:', socket.id))
  socket.on('disconnect',    (r) => console.log('[Socket] Disconnected:', r))
  socket.on('connect_error', (e) => console.warn('[Socket] Error:', e.message))

  return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}

export const joinSurvey  = (surveyId) => socket?.emit('join_survey', surveyId)
export const leaveSurvey = (surveyId) => socket?.emit('leave_survey', surveyId)

export const emitSurveyUpdate = (surveyId, data = {}) =>
  socket?.emit('survey_updated', { surveyId, data })

export const emitCursorMove = (surveyId, position) =>
  socket?.emit('cursor_move', { surveyId, position })

export const EVENTS = {
  SURVEY_UPDATED: 'survey_updated',
  ROOM_USERS:     'room_users',
  USER_JOINED:    'user_joined',
  USER_LEFT:      'user_left',
  CURSOR_MOVE:    'cursor_move',
}
