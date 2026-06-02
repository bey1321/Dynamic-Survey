import { Router } from 'express'
import pool from '../services/db.js'
import { authenticate } from '../middleware/auth.js'

const router = Router({ mergeParams: true })
router.use(authenticate)

// GET /api/surveys/:id/collaborators
router.get('/', async (req, res) => {
  try {
    const { rows: survey } = await pool.query(
      'SELECT id FROM surveys WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!survey[0])
      return res.status(403).json({ error: 'Only the survey owner can manage collaborators' })

    const { rows } = await pool.query(
      `SELECT sc.user_id, sc.permission, sc.created_at,
              u.username, u.email, u.avatar_url
       FROM survey_collaborators sc
       JOIN users u ON u.id = sc.user_id
       WHERE sc.survey_id = $1
       ORDER BY sc.created_at DESC`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[collaborators/list]', err)
    res.status(500).json({ error: 'Failed to fetch collaborators' })
  }
})

// POST /api/surveys/:id/collaborators — invite by username or email
router.post('/', async (req, res) => {
  const { usernameOrEmail, permission = 'VIEW' } = req.body
  if (!usernameOrEmail?.trim())
    return res.status(400).json({ error: 'usernameOrEmail is required' })
  if (!['VIEW', 'EDIT'].includes(permission))
    return res.status(400).json({ error: "permission must be 'VIEW' or 'EDIT'" })

  try {
    const { rows: survey } = await pool.query(
      'SELECT id FROM surveys WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!survey[0])
      return res.status(403).json({ error: 'Only the survey owner can invite collaborators' })

    const term = usernameOrEmail.trim()
    const { rows: users } = await pool.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $1',
      [term]
    )
    if (!users[0])
      return res.status(404).json({ error: 'No user found with that username or email' })

    const target = users[0]
    if (target.id === req.user.id)
      return res.status(400).json({ error: 'You cannot invite yourself' })

    const { rows } = await pool.query(
      `INSERT INTO survey_collaborators (survey_id, user_id, permission, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (survey_id, user_id) DO UPDATE SET permission = EXCLUDED.permission
       RETURNING *`,
      [req.params.id, target.id, permission, req.user.id]
    )

    res.status(201).json({ ...rows[0], username: target.username, email: target.email })
  } catch (err) {
    console.error('[collaborators/invite]', err)
    res.status(500).json({ error: 'Failed to invite collaborator' })
  }
})

// PUT /api/surveys/:id/collaborators/:userId — change permission
router.put('/:userId', async (req, res) => {
  const { permission } = req.body
  if (!['VIEW', 'EDIT'].includes(permission))
    return res.status(400).json({ error: "permission must be 'VIEW' or 'EDIT'" })

  try {
    const { rows: survey } = await pool.query(
      'SELECT id FROM surveys WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!survey[0])
      return res.status(403).json({ error: 'Only the survey owner can change permissions' })

    const { rows } = await pool.query(
      `UPDATE survey_collaborators SET permission = $1
       WHERE survey_id = $2 AND user_id = $3
       RETURNING *`,
      [permission, req.params.id, req.params.userId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Collaborator not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('[collaborators/update]', err)
    res.status(500).json({ error: 'Failed to update collaborator permission' })
  }
})

// DELETE /api/surveys/:id/collaborators/:userId — remove (owner removes anyone; user removes self)
router.delete('/:userId', async (req, res) => {
  try {
    const isSelf = req.params.userId === req.user.id

    if (!isSelf) {
      const { rows: survey } = await pool.query(
        'SELECT id FROM surveys WHERE id = $1 AND owner_id = $2',
        [req.params.id, req.user.id]
      )
      if (!survey[0])
        return res.status(403).json({ error: 'Only the survey owner can remove collaborators' })
    }

    const { rowCount } = await pool.query(
      'DELETE FROM survey_collaborators WHERE survey_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    )
    if (rowCount === 0) return res.status(404).json({ error: 'Collaborator not found' })
    res.status(204).send()
  } catch (err) {
    console.error('[collaborators/remove]', err)
    res.status(500).json({ error: 'Failed to remove collaborator' })
  }
})

export default router
