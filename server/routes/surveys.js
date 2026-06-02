import { Router } from 'express'
import { randomUUID } from 'crypto'
import pool from '../services/db.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// GET /api/surveys
router.get('/', async (req, res) => {
  try {
    const { rows: owned } = await pool.query(
      `SELECT s.*,
         (SELECT row_to_json(v) FROM (
           SELECT version_number, label, created_at FROM survey_versions
           WHERE survey_id = s.id ORDER BY version_number DESC LIMIT 1
         ) v) AS latest_version,
         (SELECT COUNT(*) FROM survey_versions WHERE survey_id = s.id)::int AS version_count
       FROM surveys s
       WHERE s.owner_id = $1
       ORDER BY s.updated_at DESC`,
      [req.user.id]
    )

    const { rows: collaborated } = await pool.query(
      `SELECT s.*,
         row_to_json(u) AS owner,
         (SELECT row_to_json(v) FROM (
           SELECT version_number, label, created_at FROM survey_versions
           WHERE survey_id = s.id ORDER BY version_number DESC LIMIT 1
         ) v) AS latest_version,
         (SELECT COUNT(*) FROM survey_versions WHERE survey_id = s.id)::int AS version_count,
         sc.permission AS my_permission
       FROM surveys s
       JOIN survey_collaborators sc ON sc.survey_id = s.id AND sc.user_id = $1
       JOIN (SELECT id, username FROM users) u ON u.id = s.owner_id
       ORDER BY s.updated_at DESC`,
      [req.user.id]
    )

    res.json({ owned, collaborated })
  } catch (err) {
    console.error('[surveys/list]', err)
    res.status(500).json({ error: 'Failed to fetch surveys' })
  }
})

// POST /api/surveys
router.post('/', async (req, res) => {
  const { title, description, language, snapshot } = req.body
  if (!snapshot) return res.status(400).json({ error: 'snapshot is required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const surveyId = randomUUID()
    const { rows } = await client.query(
      `INSERT INTO surveys (id, owner_id, title, description, language, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [surveyId, req.user.id, title?.trim() || 'Untitled Survey', description?.trim() ?? null, language || 'en']
    )
    const survey = rows[0]
    await client.query(
      `INSERT INTO survey_versions (id, survey_id, version_number, label, snapshot, created_by)
       VALUES ($1, $2, 1, 'Initial save', $3, $4)`,
      [randomUUID(), survey.id, JSON.stringify(snapshot), req.user.id]
    )
    await client.query('COMMIT')
    res.status(201).json(survey)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[surveys/create]', err)
    res.status(500).json({ error: 'Failed to create survey' })
  } finally {
    client.release()
  }
})

// GET /api/surveys/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
         row_to_json(u) AS owner,
         (SELECT row_to_json(v) FROM (
           SELECT * FROM survey_versions WHERE survey_id = s.id ORDER BY version_number DESC LIMIT 1
         ) v) AS latest_version,
         (SELECT COUNT(*) FROM survey_versions WHERE survey_id = s.id)::int AS version_count,
         (SELECT permission FROM survey_collaborators WHERE survey_id = s.id AND user_id = $2) AS my_permission
       FROM surveys s
       JOIN (SELECT id, username, email FROM users) u ON u.id = s.owner_id
       WHERE s.id = $1
         AND (s.owner_id = $2 OR EXISTS (
           SELECT 1 FROM survey_collaborators WHERE survey_id = s.id AND user_id = $2
         ))`,
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Survey not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('[surveys/get]', err)
    res.status(500).json({ error: 'Failed to fetch survey' })
  }
})

// PUT /api/surveys/:id
router.put('/:id', async (req, res) => {
  const { title, description, status, language, snapshot, versionLabel } = req.body

  const client = await pool.connect()
  try {
    const { rows: access } = await client.query(
      `SELECT s.id,
         COALESCE(
           (SELECT MAX(version_number) FROM survey_versions WHERE survey_id = s.id), 0
         ) AS max_version
       FROM surveys s
       WHERE s.id = $1
         AND (s.owner_id = $2 OR EXISTS (
           SELECT 1 FROM survey_collaborators
           WHERE survey_id = s.id AND user_id = $2 AND permission = 'EDIT'
         ))`,
      [req.params.id, req.user.id]
    )
    if (!access[0])
      return res.status(404).json({ error: 'Survey not found or insufficient permissions' })

    await client.query('BEGIN')

    const fields = []
    const vals   = []
    let   idx    = 1

    if (title       !== undefined) { fields.push(`title = $${idx++}`);       vals.push(title.trim()) }
    if (description !== undefined) { fields.push(`description = $${idx++}`); vals.push(description) }
    if (status      !== undefined) { fields.push(`status = $${idx++}`);      vals.push(status) }
    if (language    !== undefined) { fields.push(`language = $${idx++}`);    vals.push(language) }

    fields.push(`updated_at = NOW()`)

    const { rows } = await client.query(
      `UPDATE surveys SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      [...vals, req.params.id]
    )

    if (snapshot) {
      const nextVersion = access[0].max_version + 1
      await client.query(
        `INSERT INTO survey_versions (id, survey_id, version_number, label, snapshot, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), req.params.id, nextVersion, versionLabel?.trim() || null, JSON.stringify(snapshot), req.user.id]
      )
    }

    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[surveys/update]', err)
    res.status(500).json({ error: 'Failed to update survey' })
  } finally {
    client.release()
  }
})

// DELETE /api/surveys/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM surveys WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (rowCount === 0)
      return res.status(404).json({ error: 'Survey not found or you are not the owner' })
    res.status(204).send()
  } catch (err) {
    console.error('[surveys/delete]', err)
    res.status(500).json({ error: 'Failed to delete survey' })
  }
})

export default router
