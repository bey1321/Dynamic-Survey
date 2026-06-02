import React, { useState, useEffect, useCallback } from 'react'
import { createSurveyApi } from '../services/api'

const PERM_OPTIONS = [
  { value: 'VIEW', label: 'Can view' },
  { value: 'EDIT', label: 'Can edit' },
]

const EXPIRY_OPTIONS = [
  { value: '',   label: 'Never expires' },
  { value: '7',  label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

function formatExpiry(iso) {
  if (!iso) return 'No expiry'
  const d = new Date(iso)
  return `Expires ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function PermBadge({ perm }) {
  const isEdit = perm === 'EDIT'
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{
        backgroundColor: isEdit ? '#eaf4f8' : '#f0f8f0',
        color: isEdit ? '#1B6B8A' : '#1a7a40',
      }}
    >
      {isEdit ? 'Can edit' : 'Can view'}
    </span>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for browsers that block clipboard without user gesture
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs font-semibold px-3 py-1 rounded-full transition-colors duration-150"
      style={{
        backgroundColor: copied ? '#5BBF8E' : '#eaf4f8',
        color: copied ? '#ffffff' : '#1B6B8A',
      }}
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}

// ─── Share Link Tab ───────────────────────────────────────────────────────────

function ShareLinkTab({ surveyId, token }) {
  const api = createSurveyApi(token)

  const [links,      setLinks]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [perm,       setPerm]       = useState('VIEW')
  const [expiry,     setExpiry]     = useState('')
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState(null)

  const fetchLinks = useCallback(async () => {
    try {
      const data = await api.listShares(surveyId)
      setLinks(data)
    } catch {
      setError('Failed to load share links.')
    } finally {
      setLoading(false)
    }
  }, [surveyId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const link = await api.createShare(surveyId, {
        permission: perm,
        expiresInDays: expiry ? Number(expiry) : null,
      })
      setLinks(prev => [link, ...prev])
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleRevoke = async (shareId) => {
    try {
      await api.revokeShare(surveyId, shareId)
      setLinks(prev => prev.filter(l => l.id !== shareId))
    } catch {
      setError('Failed to revoke link.')
    }
  }

  const makeUrl = (shareToken) =>
    `${window.location.origin}/shared/${shareToken}`

  return (
    <div className="space-y-5">
      {/* Generator row */}
      <div
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: '#d0eaea', backgroundColor: '#f8fdfd' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#5a8a8a' }}>
          Generate a new link
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={perm}
            onChange={(e) => setPerm(e.target.value)}
            className="text-sm rounded-lg border px-3 py-1.5 focus:outline-none"
            style={{ borderColor: '#d0eaea', color: '#1B6B8A' }}
          >
            {PERM_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="text-sm rounded-lg border px-3 py-1.5 focus:outline-none"
            style={{ borderColor: '#d0eaea', color: '#1B6B8A' }}
          >
            {EXPIRY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-sm font-semibold px-4 py-1.5 rounded-full text-white transition-colors duration-150 disabled:opacity-50"
            style={{ backgroundColor: '#1B6B8A' }}
            onMouseEnter={(e) => !generating && (e.currentTarget.style.backgroundColor = '#2AABBA')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1B6B8A')}
          >
            {generating ? 'Generating…' : 'Generate link'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Active links */}
      {loading ? (
        <p className="text-sm text-center py-4" style={{ color: '#aaaaaa' }}>Loading links…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: '#aaaaaa' }}>
          No active share links. Generate one above.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#5a8a8a' }}>
            Active links ({links.length})
          </p>
          {links.map(link => (
            <div
              key={link.id}
              className="rounded-xl border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: '#d0eaea', backgroundColor: '#ffffff' }}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-xs font-mono truncate" style={{ color: '#5a8a8a' }}>
                  {makeUrl(link.share_token)}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <PermBadge perm={link.permission} />
                  <span className="text-xs" style={{ color: '#aaaaaa' }}>
                    {formatExpiry(link.expires_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <CopyButton text={makeUrl(link.share_token)} />
                <button
                  onClick={() => handleRevoke(link.id)}
                  className="text-xs font-semibold px-3 py-1 rounded-full transition-colors duration-150"
                  style={{ color: '#e05555', border: '1px solid #e05555', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff0f0')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Collaborators Tab ────────────────────────────────────────────────────────

function CollaboratorsTab({ surveyId, token }) {
  const api = createSurveyApi(token)

  const [collaborators, setCollaborators] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [invite,        setInvite]        = useState('')
  const [invitePerm,    setInvitePerm]    = useState('VIEW')
  const [inviting,      setInviting]      = useState(false)
  const [error,         setError]         = useState(null)

  const fetchCollaborators = useCallback(async () => {
    try {
      const data = await api.listCollaborators(surveyId)
      setCollaborators(data)
    } catch {
      setError('Failed to load collaborators.')
    } finally {
      setLoading(false)
    }
  }, [surveyId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCollaborators() }, [fetchCollaborators])

  const handleInvite = async () => {
    if (!invite.trim()) return
    setInviting(true)
    setError(null)
    try {
      const collab = await api.inviteCollaborator(surveyId, {
        usernameOrEmail: invite.trim(),
        permission: invitePerm,
      })
      setCollaborators(prev => {
        const existing = prev.findIndex(c => c.user_id === collab.user_id)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = collab
          return next
        }
        return [collab, ...prev]
      })
      setInvite('')
    } catch (e) {
      setError(e.message)
    } finally {
      setInviting(false)
    }
  }

  const handlePermChange = async (userId, newPerm) => {
    try {
      await api.updateCollaborator(surveyId, userId, { permission: newPerm })
      setCollaborators(prev =>
        prev.map(c => c.user_id === userId ? { ...c, permission: newPerm } : c)
      )
    } catch {
      setError('Failed to update permission.')
    }
  }

  const handleRemove = async (userId) => {
    try {
      await api.removeCollaborator(surveyId, userId)
      setCollaborators(prev => prev.filter(c => c.user_id !== userId))
    } catch {
      setError('Failed to remove collaborator.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Invite row */}
      <div
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: '#d0eaea', backgroundColor: '#f8fdfd' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#5a8a8a' }}>
          Invite a collaborator
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Username or email"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            className="flex-1 min-w-0 text-sm rounded-lg border px-3 py-1.5 focus:outline-none focus:ring-1"
            style={{ borderColor: '#d0eaea', color: '#1B6B8A', minWidth: '160px' }}
          />
          <select
            value={invitePerm}
            onChange={(e) => setInvitePerm(e.target.value)}
            className="text-sm rounded-lg border px-3 py-1.5 focus:outline-none"
            style={{ borderColor: '#d0eaea', color: '#1B6B8A' }}
          >
            {PERM_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !invite.trim()}
            className="text-sm font-semibold px-4 py-1.5 rounded-full text-white transition-colors duration-150 disabled:opacity-50"
            style={{ backgroundColor: '#1B6B8A' }}
            onMouseEnter={(e) => !inviting && (e.currentTarget.style.backgroundColor = '#2AABBA')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1B6B8A')}
          >
            {inviting ? 'Inviting…' : 'Invite'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Collaborator list */}
      {loading ? (
        <p className="text-sm text-center py-4" style={{ color: '#aaaaaa' }}>Loading collaborators…</p>
      ) : collaborators.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: '#aaaaaa' }}>
          No collaborators yet. Invite someone above.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#5a8a8a' }}>
            Collaborators ({collaborators.length})
          </p>
          {collaborators.map(c => (
            <div
              key={c.user_id}
              className="rounded-xl border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: '#d0eaea', backgroundColor: '#ffffff' }}
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                style={{ backgroundColor: '#2AABBA' }}
              >
                {(c.username || '?')[0].toUpperCase()}
              </div>

              {/* Name / email */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: '#1B6B8A' }}>
                  {c.username}
                </div>
                <div className="text-xs truncate" style={{ color: '#5a8a8a' }}>
                  {c.email}
                </div>
              </div>

              {/* Permission toggle */}
              <select
                value={c.permission}
                onChange={(e) => handlePermChange(c.user_id, e.target.value)}
                className="text-xs rounded-lg border px-2 py-1 focus:outline-none flex-shrink-0"
                style={{ borderColor: '#d0eaea', color: '#1B6B8A' }}
              >
                {PERM_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Remove */}
              <button
                onClick={() => handleRemove(c.user_id)}
                className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 transition-colors duration-150"
                style={{ color: '#e05555', border: '1px solid #e05555', backgroundColor: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff0f0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ShareModal({ surveyId, token, onClose }) {
  const [tab, setTab] = useState('link')

  const TAB_STYLE = (active) => ({
    color:       active ? '#1B6B8A'  : '#5a8a8a',
    borderBottom: active ? '2px solid #1B6B8A' : '2px solid transparent',
    fontWeight:  active ? 700 : 500,
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden flex flex-col"
        style={{ maxWidth: '520px', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b"
          style={{ borderColor: '#d0eaea', backgroundColor: '#f0f8f8' }}
        >
          <h2 className="text-base font-bold" style={{ color: '#1B6B8A' }}>
            Share &amp; Collaborate
          </h2>
          <button
            onClick={onClose}
            className="text-lg font-light leading-none transition-colors duration-150 w-7 h-7 flex items-center justify-center rounded-full"
            style={{ color: '#5a8a8a' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0f0f0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex flex-shrink-0 border-b px-6"
          style={{ borderColor: '#d0eaea' }}
        >
          {[
            { key: 'link',          label: 'Share Link'     },
            { key: 'collaborators', label: 'Collaborators'  },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="text-sm py-3 mr-6 transition-colors duration-150"
              style={TAB_STYLE(tab === key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'link' ? (
            <ShareLinkTab surveyId={surveyId} token={token} />
          ) : (
            <CollaboratorsTab surveyId={surveyId} token={token} />
          )}
        </div>
      </div>
    </div>
  )
}
