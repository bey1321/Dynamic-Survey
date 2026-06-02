import { Router } from 'express'
import { randomUUID } from 'crypto'
import pool from '../services/db.js'
import { authenticate } from '../middleware/auth.js'

const router = Router({ mergeParams: true })
router.use(authenticate)

const hasAccess = async (surveyId, userId) => {
  const { rows } = await pool.query(
    `SELECT id FROM surveys WHERE id = $1
       AND (owner_id = $2 OR EXISTS (
         SELECT 1 FROM survey_collaborators WHERE survey_id = $1 AND user_id = $2
       ))`,
    [surveyId, userId]
  )
  return rows.length > 0
}

// GET /api/surveys/:id/versions
router.get('/', async (req, res) => {
  try {
    if (!(await hasAccess(req.params.id, req.user.id)))
      return res.status(404).json({ error: 'Survey not found' })

    const { rows } = await pool.query(
      `SELECT v.id, v.version_number, v.label, v.created_at,
         json_build_object('id', u.id, 'username', u.username) AS creator
       FROM survey_versions v
       JOIN users u ON u.id = v.created_by
       WHERE v.survey_id = $1
       ORDER BY v.version_number DESC`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[versions/list]', err)
    res.status(500).json({ error: 'Failed to fetch versions' })
  }
})

// GET /api/surveys/:id/versions/:versionId
router.get('/:versionId', async (req, res) => {
  try {
    if (!(await hasAccess(req.params.id, req.user.id)))
      return res.status(404).json({ error: 'Survey not found' })

    const { rows } = await pool.query(
      `SELECT v.*,
         json_build_object('id', u.id, 'username', u.username) AS creator
       FROM survey_versions v
       JOIN users u ON u.id = v.created_by
       WHERE v.id = $1 AND v.survey_id = $2`,
      [req.params.versionId, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Version not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('[versions/get]', err)
    res.status(500).json({ error: 'Failed to fetch version' })
  }
})

// POST /api/surveys/:id/versions/:versionId/restore
router.post('/:versionId/restore', async (req, res) => {
  const client = await pool.connect()
  try {
    const { rows: access } = await client.query(
      `SELECT id FROM surveys WHERE id = $1
         AND (owner_id = $2 OR EXISTS (
           SELECT 1 FROM survey_collaborators
           WHERE survey_id = $1 AND user_id = $2 AND permission = 'EDIT'
         ))`,
      [req.params.id, req.user.id]
    )
    if (!access[0])
      return res.status(404).json({ error: 'Survey not found or insufficient permissions' })

    const { rows: target } = await client.query(
      'SELECT * FROM survey_versions WHERE id = $1 AND survey_id = $2',
      [req.params.versionId, req.params.id]
    )
    if (!target[0]) return res.status(404).json({ error: 'Version not found' })

    const { rows: maxRows } = await client.query(
      'SELECT COALESCE(MAX(version_number), 0) AS max FROM survey_versions WHERE survey_id = $1',
      [req.params.id]
    )
    const nextVersion = maxRows[0].max + 1

    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO survey_versions (id, survey_id, version_number, label, snapshot, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        randomUUID(),
        req.params.id,
        nextVersion,
        `Restored from v${target[0].version_number}`,
        JSON.stringify(target[0].snapshot),
        req.user.id,
      ]
    )
    await client.query('UPDATE surveys SET updated_at = NOW() WHERE id = $1', [req.params.id])
    await client.query('COMMIT')

    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[versions/restore]', err)
    res.status(500).json({ error: 'Failed to restore version' })
  } finally {
    client.release()
  }
})

export default router
