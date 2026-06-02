import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { useSurvey } from '../state/SurveyContext';
import { createSurveyApi } from '../services/api';
import rakscLogo from '../assets/raksc-logo.png';
import ProfileDropdown from '../components/ProfileDropdown';
import ShareModal from '../components/ShareModal';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_STYLE = {
  DRAFT:     { bg: '#fef9e7', color: '#8a6c00', label: 'Draft' },
  PUBLISHED: { bg: '#eafaf0', color: '#1a7a40', label: 'Published' },
  ARCHIVED:  { bg: '#f5f5f5', color: '#777777', label: 'Archived' },
};

const Q_TYPE_LABELS = {
  likert:          'Likert',
  multiple_choice: 'Multiple Choice',
  multi_select:    'Multi-Select',
  yes_no:          'Yes / No',
  rating:          'Rating',
  open_ended:      'Open Ended',
};

// ─── sub-components ──────────────────────────────────────────────────────────

function SurveyListCard({ survey, selected, onClick }) {
  const ss = STATUS_STYLE[survey.status] || STATUS_STYLE.DRAFT;
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 focus:outline-none"
      style={{
        borderColor: selected ? '#1B6B8A' : '#d0eaea',
        backgroundColor: selected ? '#eaf4f8' : '#ffffff',
        boxShadow: selected ? '0 0 0 2px #1B6B8A22' : 'none',
      }}
    >
      <div className="font-semibold text-sm truncate" style={{ color: '#1B6B8A' }}>
        {survey.title || 'Untitled Survey'}
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="text-xs" style={{ color: '#5a8a8a' }}>
          {formatDate(survey.updated_at)}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: ss.bg, color: ss.color }}
        >
          {ss.label}
        </span>
        {survey.version_count > 0 && (
          <span className="text-xs" style={{ color: '#aaaaaa' }}>
            {survey.version_count} version{survey.version_count !== 1 ? 's' : ''}
          </span>
        )}
        {survey.my_permission === 'VIEW' && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#f0f8f0', color: '#1a7a40' }}>
            View access
          </span>
        )}
        {survey.my_permission === 'EDIT' && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#eaf4f8', color: '#1B6B8A' }}>
            Edit access
          </span>
        )}
      </div>
    </button>
  );
}

function VariableModelSection({ model }) {
  if (!model) return null;

  const sections = [
    { key: 'dependent', label: 'Dependent Variable (Primary Outcome)', accent: '#1B6B8A' },
    { key: 'drivers',   label: 'Drivers (Independent Variables)',       accent: '#2AABBA' },
    { key: 'controls',  label: 'Controls & Demographics',               accent: '#5BBF8E' },
  ];

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#5a8a8a' }}>
        Variable Model
      </h3>
      <div className="space-y-3">
        {sections.map(({ key, label, accent }) => {
          const items = model[key];
          if (!Array.isArray(items) || items.length === 0) return null;
          return (
            <div key={key} className="rounded-xl border overflow-hidden" style={{ borderColor: '#d0eaea' }}>
              <div
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: accent + '18', color: accent, borderBottom: `1px solid ${accent}33` }}
              >
                {label}
              </div>
              <div className="divide-y" style={{ divideColor: '#f0f8f8' }}>
                {items.map((item, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className="text-sm font-semibold" style={{ color: '#1B6B8A' }}>
                      {item.name || item}
                    </div>
                    {item.rationale && (
                      <div className="text-xs mt-0.5" style={{ color: '#5a8a8a' }}>
                        {item.rationale}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionBadge({ type }) {
  const label = Q_TYPE_LABELS[type] || type || 'Unknown';
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ backgroundColor: '#e8f4f8', color: '#1B6B8A' }}
    >
      {label}
    </span>
  );
}

function QuestionsSection({ questions }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return (
      <div className="text-sm text-center py-6" style={{ color: '#aaaaaa' }}>
        No questions saved in this version.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#5a8a8a' }}>
        Questions ({questions.length})
      </h3>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div
            key={q.id || i}
            className="rounded-xl border px-4 py-3"
            style={{ borderColor: '#d0eaea', backgroundColor: '#fafeff' }}
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
    </div>
  );
}

function SurveyDetail({ surveyId, token, onEdit, onDelete }) {
  const [detail,    setDetail]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!surveyId) return;
    setDetail(null);
    setError(null);
    setLoading(true);
    createSurveyApi(token)
      .getSurvey(surveyId)
      .then(setDetail)
      .catch(() => setError('Could not load survey details.'))
      .finally(() => setLoading(false));
  }, [surveyId, token]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this survey? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await createSurveyApi(token).deleteSurvey(surveyId);
      onDelete(surveyId);
    } catch {
      alert('Failed to delete survey.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: '#5a8a8a' }}>
        <div className="text-sm">Loading survey…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  if (!detail) return null;

  const snap = detail.latest_version?.snapshot || {};

  // DB snapshot: { surveyDraft, variableModel: rawModel, questions: [] }
  // ctx snapshot: { variableModel: { model: {...}, ... }, questionsState: { questions: [] } }
  const model = snap.variableModel?.model ?? snap.variableModel ?? null;
  const questions = snap.questions ?? snap.questionsState?.questions ?? [];
  const ss      = STATUS_STYLE[detail.status] || STATUS_STYLE.DRAFT;
  const isOwner = !detail.my_permission;
  const canEdit = isOwner || detail.my_permission === 'EDIT';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 flex-shrink-0 border-b"
        style={{ backgroundColor: '#f0f8f8', borderColor: '#d0eaea' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: '#1B6B8A' }}>
              {detail.title || 'Untitled Survey'}
            </h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: ss.bg, color: ss.color }}
              >
                {ss.label}
              </span>
              <span className="text-xs" style={{ color: '#5a8a8a' }}>
                Updated {formatDate(detail.updated_at)}
              </span>
              <span className="text-xs" style={{ color: '#5a8a8a' }}>
                {detail.version_count} version{detail.version_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOwner && (
              <button
                onClick={() => setShowShare(true)}
                className="text-sm font-semibold px-4 py-1.5 rounded-full transition-colors duration-150"
                style={{ color: '#1B6B8A', border: '1px solid #1B6B8A', backgroundColor: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eaf4f8')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Share
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => onEdit(detail)}
                className="text-sm font-semibold px-4 py-1.5 rounded-full text-white transition-colors duration-150"
                style={{ backgroundColor: '#1B6B8A' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2AABBA')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1B6B8A')}
              >
                Edit in Studio
              </button>
            )}
            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-semibold px-4 py-1.5 rounded-full transition-colors duration-150 disabled:opacity-50"
                style={{ color: '#e05555', border: '1px solid #e05555', backgroundColor: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff0f0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <VariableModelSection model={model} />
        <QuestionsSection questions={questions} />
      </div>

      {showShare && (
        <ShareModal
          surveyId={detail.id}
          token={token}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function MySurveysPage() {
  const { token } = useAuth();
  const { loadFromSnapshot } = useSurvey();
  const navigate = useNavigate();

  const [surveys, setSurveys]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    createSurveyApi(token)
      .listSurveys()
      .then((data) => {
        const all = [...(data.owned || []), ...(data.collaborated || [])];
        setSurveys(all);
        if (all.length > 0) setSelectedId(all[0].id);
      })
      .catch(() => setError('Failed to load surveys.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleEdit = async (detail) => {
    const snap = detail.latest_version?.snapshot;
    if (snap) loadFromSnapshot(snap, detail.id);
    navigate('/survey/step/3-questions');
  };

  const handleDelete = (deletedId) => {
    setSurveys((prev) => {
      const next = prev.filter((s) => s.id !== deletedId);
      setSelectedId(next.length > 0 ? next[0].id : null);
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f8f8' }}>
      {/* Navbar */}
      <nav
        className="flex items-center justify-between px-10 py-4 border-b flex-shrink-0"
        style={{ backgroundColor: '#ffffff', borderColor: '#d0eaea' }}
      >
        <Link to="/" className="flex items-center">
          <img src={rakscLogo} alt="RAK Statistics Logo" className="h-14 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-6 text-sm font-semibold">
          <Link
            to="/"
            className="transition-colors duration-150"
            style={{ color: '#5a8a8a' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#1B6B8A')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#5a8a8a')}
          >
            ← Home
          </Link>
          <ProfileDropdown />
        </div>
      </nav>

      {/* Page header */}
      <div className="px-10 pt-8 pb-4 flex-shrink-0">
        <h1 className="text-3xl font-serif font-semibold" style={{ color: '#1B6B8A' }}>
          My Surveys
        </h1>
        <p className="text-sm mt-1" style={{ color: '#5a8a8a' }}>
          All surveys you have created or collaborated on.
        </p>
        <div
          className="w-16 h-1 rounded-full mt-3"
          style={{ background: 'linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden px-10 pb-8 gap-5 min-h-0">
        {loading && (
          <div className="flex-1 flex items-center justify-center" style={{ color: '#5a8a8a' }}>
            Loading your surveys…
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
        )}

        {!loading && !error && surveys?.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-sm" style={{ color: '#5a8a8a' }}>You haven't created any surveys yet.</p>
            <button
              onClick={() => navigate('/')}
              className="text-sm font-semibold px-6 py-2.5 rounded-full text-white"
              style={{ backgroundColor: '#1B6B8A' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2AABBA')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1B6B8A')}
            >
              Create your first survey
            </button>
          </div>
        )}

        {!loading && !error && surveys && surveys.length > 0 && (
          <>
            {/* Left panel — survey list */}
            <div
              className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto pt-1"
            >
              {surveys.map((s) => (
                <SurveyListCard
                  key={s.id}
                  survey={s}
                  selected={selectedId === s.id}
                  onClick={() => setSelectedId(s.id)}
                />
              ))}
            </div>

            {/* Right panel — detail */}
            <div
              className="flex-1 rounded-2xl border overflow-hidden flex flex-col"
              style={{ backgroundColor: '#ffffff', borderColor: '#d0eaea' }}
            >
              {selectedId ? (
                <SurveyDetail
                  key={selectedId}
                  surveyId={selectedId}
                  token={token}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#aaaaaa' }}>
                  Select a survey to view details
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
