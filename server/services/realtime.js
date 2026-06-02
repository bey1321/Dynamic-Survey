import jwt from 'jsonwebtoken'

export const initRealtime = (io) => {
  const rooms = new Map()

  const getUsers = (surveyId) =>
    Array.from((rooms.get(surveyId) ?? new Map()).values())

  io.on('connection', (socket) => {
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

    socket.on('join_survey', (surveyId) => {
      socket.join(surveyId)
      if (!rooms.has(surveyId)) rooms.set(surveyId, new Map())
      rooms.get(surveyId).set(socket.id, identity)

      io.to(surveyId).emit('room_users', getUsers(surveyId))
      socket.to(surveyId).emit('user_joined', identity)
    })

    socket.on('survey_updated', ({ surveyId, data }) => {
      socket.to(surveyId).emit('survey_updated', {
        updatedBy: identity.username,
        data,
        timestamp: new Date().toISOString(),
      })
    })

    socket.on('cursor_move', ({ surveyId, position }) => {
      socket.to(surveyId).emit('cursor_move', {
        userId:   identity.userId,
        username: identity.username,
        position,
      })
    })

    socket.on('leave_survey', (surveyId) => leaveRoom(socket, surveyId))

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
