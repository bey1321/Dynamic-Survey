/**
 * Authenticated API client for survey persistence.
 *
 * Usage:
 *   const { token } = useAuth()
 *   const api = createSurveyApi(token)
 *   const survey = await api.createSurvey({ title, snapshot: surveyContextState })
 */

const BASE = '/api'

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
  // Surveys
  listSurveys: () =>
    request('/surveys', {}, token),

  createSurvey: ({ title, description, language, snapshot }) =>
    request('/surveys', {
      method: 'POST',
      body: JSON.stringify({ title, description, language, snapshot }),
    }, token),

  getSurvey: (id) =>
    request(`/surveys/${id}`, {}, token),

  updateSurvey: (id, { title, description, status, language, snapshot, versionLabel } = {}) =>
    request(`/surveys/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, description, status, language, snapshot, versionLabel }),
    }, token),

  deleteSurvey: (id) =>
    request(`/surveys/${id}`, { method: 'DELETE' }, token),

  // Versions
  listVersions: (surveyId) =>
    request(`/surveys/${surveyId}/versions`, {}, token),

  getVersion: (surveyId, versionId) =>
    request(`/surveys/${surveyId}/versions/${versionId}`, {}, token),

  restoreVersion: (surveyId, versionId) =>
    request(`/surveys/${surveyId}/versions/${versionId}/restore`, { method: 'POST' }, token),

  // Shares
  listShares: (surveyId) =>
    request(`/surveys/${surveyId}/shares`, {}, token),

  createShare: (surveyId, { permission = 'VIEW', expiresInDays = null } = {}) =>
    request(`/surveys/${surveyId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ permission, expiresInDays }),
    }, token),

  revokeShare: (surveyId, shareId) =>
    request(`/surveys/${surveyId}/shares/${shareId}`, { method: 'DELETE' }, token),

  // Collaborators (owner only)
  listCollaborators: (surveyId) =>
    request(`/surveys/${surveyId}/collaborators`, {}, token),

  inviteCollaborator: (surveyId, { usernameOrEmail, permission = 'VIEW' }) =>
    request(`/surveys/${surveyId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, permission }),
    }, token),

  updateCollaborator: (surveyId, userId, { permission }) =>
    request(`/surveys/${surveyId}/collaborators/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ permission }),
    }, token),

  removeCollaborator: (surveyId, userId) =>
    request(`/surveys/${surveyId}/collaborators/${userId}`, { method: 'DELETE' }, token),

  // Public access (no auth token needed)
  getSharedSurvey: (shareToken) =>
    request(`/shared/${shareToken}`),

  // Accept an EDIT share link — registers the logged-in user as an EDIT collaborator
  acceptShare: (shareToken) =>
    request(`/shared/${shareToken}/accept`, { method: 'POST' }, token),
})
