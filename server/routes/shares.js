import { Router } from 'express'
import { randomBytes, randomUUID } from 'crypto'
import pool from '../services/db.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'

// Public router — no login required
export const publicRouter = Router()

// POST /api/shared/:token/accept — authenticated user accepts an EDIT share link,
// registering themselves as a collaborator so they can save changes.
publicRouter.post('/:token/accept', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sh.*, s.owner_id
       FROM survey_shares sh
       JOIN surveys s ON s.id = sh.survey_id
       WHERE sh.share_token = $1`,
      [req.params.token]
    )

    const share = rows[0]
    if (!share || !share.is_active)
      return res.status(404).json({ error: 'Share link not found or has been revoked' })
    if (share.expires_at && new Date(share.expires_at) < new Date())
      return res.status(410).json({ error: 'This share link has expired' })
    if (share.permission !== 'EDIT')
      return res.status(403).json({ error: 'This share link does not grant edit access' })
    if (share.owner_id === req.user.id)
      return res.status(400).json({ error: 'You are the owner of this survey' })

    await pool.query(
      `INSERT INTO survey_collaborators (survey_id, user_id, permission, invited_by)
       VALUES ($1, $2, 'EDIT', $3)
       ON CONFLICT (survey_id, user_id) DO UPDATE SET permission = 'EDIT'`,
      [share.survey_id, req.user.id, share.created_by]
    )

    res.json({ surveyId: share.survey_id })
  } catch (err) {
    console.error('[shared/accept]', err)
    res.status(500).json({ error: 'Failed to accept share' })
  }
})

publicRouter.get('/:token', optionalAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sh.*,
         row_to_json(s) AS survey,
         json_build_object('id', u.id, 'username', u.username) AS shared_by_user
       FROM survey_shares sh
       JOIN (
         SELECT sv.*,
           (SELECT row_to_json(v) FROM (
             SELECT * FROM survey_versions WHERE survey_id = sv.id ORDER BY version_number DESC LIMIT 1
           ) v) AS latest_version
         FROM surveys sv
       ) s ON s.id = sh.survey_id
       JOIN users u ON u.id = sh.created_by
       WHERE sh.share_token = $1`,
      [req.params.token]
    )

    const share = rows[0]
    if (!share || !share.is_active)
      return res.status(404).json({ error: 'Share link not found or has been revoked' })
    if (share.expires_at && new Date(share.expires_at) < new Date())
      return res.status(410).json({ error: 'This share link has expired' })

    res.json({
      survey:     share.survey,
      permission: share.permission,
      sharedBy:   share.shared_by_user.username,
    })
  } catch (err) {
    console.error('[shared/get]', err)
    res.status(500).json({ error: 'Failed to access shared survey' })
  }
})

// Protected router — survey owner manages share links
const router = Router({ mergeParams: true })
router.use(authenticate)

// GET /api/surveys/:id/shares
router.get('/', async (req, res) => {
  try {
    const { rows: survey } = await pool.query(
      'SELECT id FROM surveys WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!survey[0])
      return res.status(404).json({ error: 'Survey not found or you are not the owner' })

    const { rows } = await pool.query(
      `SELECT * FROM survey_shares
       WHERE survey_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[shares/list]', err)
    res.status(500).json({ error: 'Failed to fetch share links' })
  }
})

// POST /api/surveys/:id/shares
router.post('/', async (req, res) => {
  const { permission = 'VIEW', expiresInDays } = req.body
  if (!['VIEW', 'EDIT'].includes(permission))
    return res.status(400).json({ error: "permission must be 'VIEW' or 'EDIT'" })

  try {
    const { rows: survey } = await pool.query(
      'SELECT id FROM surveys WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!survey[0])
      return res.status(404).json({ error: 'Survey not found or you are not the owner' })

    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 86400000)
      : null

    const { rows } = await pool.query(
      `INSERT INTO survey_shares (id, survey_id, share_token, permission, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [randomUUID(), req.params.id, randomBytes(32).toString('hex'), permission, req.user.id, expiresAt]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('[shares/create]', err)
    res.status(500).json({ error: 'Failed to create share link' })
  }
})

// DELETE /api/surveys/:id/shares/:shareId
router.delete('/:shareId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sh.id FROM survey_shares sh
       JOIN surveys s ON s.id = sh.survey_id
       WHERE sh.id = $1 AND sh.survey_id = $2 AND s.owner_id = $3`,
      [req.params.shareId, req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Share link not found' })

    await pool.query(
      'UPDATE survey_shares SET is_active = false WHERE id = $1',
      [req.params.shareId]
    )
    res.status(204).send()
  } catch (err) {
    console.error('[shares/revoke]', err)
    res.status(500).json({ error: 'Failed to revoke share link' })
  }
})

export default router
