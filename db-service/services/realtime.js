import jwt from 'jsonwebtoken'

/**
 * Wires all Socket.io event handlers onto the io instance.
 * Called once from index.js after the server starts.
 *
 * Room model: one Socket.io room per surveyId.
 * Presence: surveyId -> Map<socketId, identity>
 */
export const initRealtime = (io) => {
  const rooms = new Map()

  const getUsers = (surveyId) =>
    Array.from((rooms.get(surveyId) ?? new Map()).values())

  io.on('connection', (socket) => {
    // Identify the connecting user via the JWT passed during handshake
    let currentUser = null
    const token = socket.handshake.auth?.token
    if (token) {
      try {
        currentUser = jwt.verify(token, process.env.JWT_SECRET)
      } catch {}
    }

    const identity = {
      socketId: socket.id,
      userId:   currentUser?.id       ?? null,
      username: currentUser?.username ?? 'Guest',
    }

    // ── join_survey ───────────────────────────────────────────────────────────
    // Emitted by the client when a survey page is opened.
    socket.on('join_survey', (surveyId) => {
      socket.join(surveyId)
      if (!rooms.has(surveyId)) rooms.set(surveyId, new Map())
      rooms.get(surveyId).set(socket.id, identity)

      io.to(surveyId).emit('room_users', getUsers(surveyId))
      socket.to(surveyId).emit('user_joined', identity)
    })

    // ── survey_updated ────────────────────────────────────────────────────────
    // Emitted after a save so all other open tabs/browsers reload instantly.
    socket.on('survey_updated', ({ surveyId, data }) => {
      socket.to(surveyId).emit('survey_updated', {
        updatedBy: identity.username,
        data,
        timestamp: new Date().toISOString(),
      })
    })

    // ── cursor_move ───────────────────────────────────────────────────────────
    // Optional: shows collaborators which question someone is currently editing.
    socket.on('cursor_move', ({ surveyId, position }) => {
      socket.to(surveyId).emit('cursor_move', {
        userId:   identity.userId,
        username: identity.username,
        position,
      })
    })

    // ── leave_survey ──────────────────────────────────────────────────────────
    socket.on('leave_survey', (surveyId) => leaveRoom(socket, surveyId))

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      for (const surveyId of rooms.keys()) {
        if (rooms.get(surveyId).has(socket.id)) leaveRoom(socket, surveyId)
      }
    })

    function leaveRoom(socket, surveyId) {
      socket.leave(surveyId)
      const room = rooms.get(surveyId)
      if (!room) return
      room.delete(socket.id)
      if (room.size === 0) {
        rooms.delete(surveyId)
      } else {
        io.to(surveyId).emit('room_users', getUsers(surveyId))
        socket.to(surveyId).emit('user_left', identity)
      }
    }
  })
}
