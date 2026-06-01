/**
 * Authenticated API client for the survey-db-service.
 *
 * The service runs on its own port (default 5000), completely separate
 * from the existing Dynamic Survey app on port 4000.
 *
 * Usage:
 *   const { token } = useAuth()
 *   const api = createSurveyApi(token)
 *
 *   // Save a completed survey
 *   const survey = await api.createSurvey({ title, snapshot: surveyContextState })
 *
 *   // Load all saved surveys
 *   const { owned, collaborated } = await api.listSurveys()
 */

const BASE = (import.meta.env.VITE_DB_SERVICE_URL || 'http://localhost:5000') + '/api'

const request = async (path, options = {}, authToken = null) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (res.status === 204) return null

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body
}

export const createSurveyApi = (token) => ({
  // ── Surveys ────────────────────────────────────────────────────────────────

  /** List surveys the user owns plus ones they collaborate on. */
  listSurveys: () =>
    request('/surveys', {}, token),

  /**
   * Save a completed survey for the first time.
   * Pass the full SurveyContext state object as `snapshot`.
   */
  createSurvey: ({ title, description, language, snapshot }) =>
    request('/surveys', {
      method: 'POST',
      body: JSON.stringify({ title, description, language, snapshot }),
    }, token),

  /** Load a survey with its latest snapshot. */
  getSurvey: (id) =>
    request(`/surveys/${id}`, {}, token),

  /**
   * Save an updated version of an existing survey.
   * Pass `snapshot` to create a new version entry in history.
   * Pass `versionLabel` to give it a human-readable name e.g. "After pilot test".
   */
  updateSurvey: (id, { title, description, status, language, snapshot, versionLabel } = {}) =>
    request(`/surveys/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, description, status, language, snapshot, versionLabel }),
    }, token),

  /** Permanently delete a survey. Owner only. */
  deleteSurvey: (id) =>
    request(`/surveys/${id}`, { method: 'DELETE' }, token),

  // ── Versions ───────────────────────────────────────────────────────────────

  /** List all saved versions (metadata only — no snapshot payloads). */
  listVersions: (surveyId) =>
    request(`/surveys/${surveyId}/versions`, {}, token),

  /** Fetch one version including its full snapshot payload. */
  getVersion: (surveyId, versionId) =>
    request(`/surveys/${surveyId}/versions/${versionId}`, {}, token),

  /**
   * Restore a past version.
   * This creates a NEW version — existing history is never deleted.
   */
  restoreVersion: (surveyId, versionId) =>
    request(`/surveys/${surveyId}/versions/${versionId}/restore`, { method: 'POST' }, token),

  // ── Shares ─────────────────────────────────────────────────────────────────

  /** List all active share links for a survey. */
  listShares: (surveyId) =>
    request(`/surveys/${surveyId}/shares`, {}, token),

  /**
   * Create a shareable link.
   * @param {'VIEW'|'EDIT'} permission
   * @param {number|null}   expiresInDays — null means the link never expires
   */
  createShare: (surveyId, { permission = 'VIEW', expiresInDays = null } = {}) =>
    request(`/surveys/${surveyId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ permission, expiresInDays }),
    }, token),

  /** Revoke a share link. It stops working immediately. */
  revokeShare: (surveyId, shareId) =>
    request(`/surveys/${surveyId}/shares/${shareId}`, { method: 'DELETE' }, token),

  // ── Public access (no auth token needed) ───────────────────────────────────

  /** Access a survey via its share token. No login required. */
  getSharedSurvey: (shareToken) =>
    request(`/shared/${shareToken}`),
})
