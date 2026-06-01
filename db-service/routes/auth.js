import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pool from '../services/db.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
const SALT_ROUNDS = 12

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

const publicUser = (u) => ({ id: u.id, email: u.email, username: u.username })

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, username, password } = req.body
  if (!email || !username || !password)
    return res.status(400).json({ error: 'email, username, and password are required' })
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username`,
      [email.toLowerCase().trim(), username.trim(), passwordHash]
    )
    const user = rows[0]
    res.status(201).json({ token: signToken(user), user: publicUser(user) })
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Email or username already in use' })
    console.error('[auth/register]', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' })

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' })

    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (err) {
    console.error('[auth/login]', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, username, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('[auth/me]', err)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

export default router
