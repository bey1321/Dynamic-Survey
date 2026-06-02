import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { createSurveyApi } from '../services/api'
import { useAuth } from '../state/AuthContext'
import { useSurvey } from '../state/SurveyContext'

const Q_TYPE_LABELS = {
  likert:          'Likert',
  multiple_choice: 'Multiple Choice',
  multi_select:    'Multi-Select',
  yes_no:          'Yes / No',
  rating:          'Rating',
  open_ended:      'Open Ended',
}

function QuestionBadge({ type }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ backgroundColor: '#e8f4f8', color: '#1B6B8A' }}
    >
      {Q_TYPE_LABELS[type] || type || 'Unknown'}
    </span>
  )
}

export default function SharedSurveyPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { token: authToken, isAuthenticated } = useAuth()
  const { loadFromSnapshot } = useSurvey()

  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [accepting,   setAccepting]   = useState(false)

  useEffect(() => {
    createSurveyApi(null)
      .getSharedSurvey(token)
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load survey.'))
      .finally(() => setLoading(false))
  }, [token])

  const handleEditInStudio = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setAccepting(true)
    try {
      const api = createSurveyApi(authToken)
      const result = await api.acceptShare(token)
      const snap = data?.survey?.latest_version?.snapshot
      loadFromSnapshot(snap, result.surveyId)
      navigate('/survey/step/3-questions')
    } catch (e) {
      alert(e.message || 'Failed to open survey for editing.')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f8f8' }}>
        <p className="text-sm" style={{ color: '#5a8a8a' }}>Loading shared survey…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#f0f8f8' }}>
        <p className="text-base font-semibold" style={{ color: '#e05555' }}>{error}</p>
        <Link
          to="/"
          className="text-sm font-semibold px-5 py-2 rounded-full text-white"
          style={{ backgroundColor: '#1B6B8A' }}
        >
          Go to home
        </Link>
      </div>
    )
  }

  const { survey, permission, sharedBy } = data
  const snap      = survey?.latest_version?.snapshot || {}
  const model     = snap.variableModel?.model ?? snap.variableModel ?? null
  const questions = snap.questions ?? snap.questionsState?.questions ?? []

  const modelSections = [
    { key: 'dependent', label: 'Dependent Variable', accent: '#1B6B8A' },
    { key: 'drivers',   label: 'Drivers',            accent: '#2AABBA' },
    { key: 'controls',  label: 'Controls',           accent: '#5BBF8E' },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f8f8' }}>
      {/* Navbar */}
      <nav
        className="flex items-center justify-between px-8 py-4 border-b"
        style={{ backgroundColor: '#ffffff', borderColor: '#d0eaea' }}
      >
        <Link to="/" className="text-sm font-semibold" style={{ color: '#5a8a8a' }}>
          ← Home
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#aaaaaa' }}>
            Shared by <span className="font-semibold" style={{ color: '#5a8a8a' }}>{sharedBy}</span>
          </span>
          <span
            className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{
              backgroundColor: permission === 'EDIT' ? '#eaf4f8' : '#f0f8f0',
              color: permission === 'EDIT' ? '#1B6B8A' : '#1a7a40',
            }}
          >
            {permission === 'EDIT' ? 'Can edit' : 'View only'}
          </span>
          {permission === 'EDIT' && (
            <button
              onClick={handleEditInStudio}
              disabled={accepting}
              className="text-sm font-semibold px-4 py-1.5 rounded-full text-white transition-colors duration-150 disabled:opacity-60"
              style={{ backgroundColor: '#1B6B8A' }}
              onMouseEnter={(e) => { if (!accepting) e.currentTarget.style.backgroundColor = '#2AABBA' }}
              onMouseLeave={(e) => { if (!accepting) e.currentTarget.style.backgroundColor = '#1B6B8A' }}
            >
              {accepting ? 'Opening…' : 'Edit in Studio'}
            </button>
          )}
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-serif font-semibold" style={{ color: '#1B6B8A' }}>
            {survey.title || 'Untitled Survey'}
          </h1>
          {survey.description && (
            <p className="mt-2 text-sm" style={{ color: '#5a8a8a' }}>{survey.description}</p>
          )}
          <div
            className="w-16 h-1 rounded-full mt-3"
            style={{ background: 'linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)' }}
          />
        </div>

        {/* Variable model */}
        {model && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#5a8a8a' }}>
              Variable Model
            </h2>
            <div className="space-y-3">
              {modelSections.map(({ key, label, accent }) => {
                const items = model[key]
                if (!Array.isArray(items) || items.length === 0) return null
                return (
                  <div key={key} className="rounded-xl border overflow-hidden" style={{ borderColor: '#d0eaea' }}>
                    <div
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                      style={{ backgroundColor: accent + '18', color: accent, borderBottom: `1px solid ${accent}33` }}
                    >
                      {label}
                    </div>
                    <div className="divide-y" style={{ borderColor: '#f0f8f8' }}>
                      {items.map((item, i) => (
                        <div key={i} className="px-4 py-2.5">
                          <div className="text-sm font-semibold" style={{ color: '#1B6B8A' }}>
                            {item.name || item}
                          </div>
                          {item.rationale && (
                            <div className="text-xs mt-0.5" style={{ color: '#5a8a8a' }}>{item.rationale}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Questions */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#5a8a8a' }}>
            Questions ({questions.length})
          </h2>
          {questions.length === 0 ? (
            <p className="text-sm" style={{ color: '#aaaaaa' }}>No questions in this version.</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div
                  key={q.id || i}
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: '#d0eaea', backgroundColor: '#ffffff' }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: '#1B6B8A', color: '#ffffff' }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className="text-sm font-medium flex-1" style={{ color: '#222' }}>
                          {q.text || '(no text)'}
                        </p>
                        <QuestionBadge type={q.type} />
                      </div>
                      {q.variable && (
                        <div className="text-xs mt-1" style={{ color: '#5a8a8a' }}>
                          Variable: <span className="font-medium" style={{ color: '#1B6B8A' }}>{q.variable}</span>
                        </div>
                      )}
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {q.options.map((opt, j) => (
                            <li key={j} className="text-xs flex items-center gap-1.5" style={{ color: '#5a8a8a' }}>
                              <span
                                className="w-3.5 h-3.5 rounded-full border flex-shrink-0 inline-block"
                                style={{ borderColor: '#1B6B8A' }}
                              />
                              {opt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
