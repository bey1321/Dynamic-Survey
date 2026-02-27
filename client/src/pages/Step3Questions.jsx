import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";
import { useToast } from "../state/ToastContext";
import { useChat } from "../state/ChatContext";
import { SurveyFlowVisualization } from "../components/SurveyFlowVisualization";
import { List, Eye, Workflow, RotateCcw, Send, Loader, MessageSquare, X, Sparkles } from "lucide-react";

const TYPE_LABELS = {
  likert: "Likert",
  multiple_choice: "Multiple Choice",
  multi_select: "Multi-Select",
  yes_no: "Yes / No",
  open_ended: "Open-Ended",
  rating: "Rating (1-10)"
};

const QUESTION_TYPES = Object.keys(TYPE_LABELS);

const ROLE_COLORS = {
  dependent: { bg: "#dbeeff", text: "#1B6B8A" },
  driver:    { bg: "#fff3d0", text: "#8a6000" },
  control:   { bg: "#e8f6f7", text: "#2AABBA" }
};

const BRANCH_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "includes", label: "Includes (any of)" },
  { value: "gte", label: ">= (greater or equal)" },
  { value: "lte", label: "<= (less or equal)" }
];

const DEFAULT_OPTIONS = {
  likert: ["1 - Strongly disagree", "2 - Disagree", "3 - Neutral", "4 - Agree", "5 - Strongly agree"],
  multiple_choice: ["Option 1", "Option 2", "Option 3"],
  multi_select: ["Option 1", "Option 2", "Option 3"],
  yes_no: ["Yes", "No"],
  open_ended: [],
  rating: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
};

function Step3Questions() {
  const {
    surveyDraft,
    variableModel,
    questionsState,
    setQuestionsFromAI,
    updateQuestions,
    setEvaluations,
    evaluations,
    approveQuestions,
  } = useSurvey();
  const { showToast } = useToast();
  const { updateConversationContext } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [narrationStages, setNarrationStages] = useState([]);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const pendingRef = useRef(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("questions");
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showQualityReport, setShowQualityReport] = useState(false);

  const questions = questionsState.questions;

  // Explicit trigger: fires when the user clicks "Next" in Step 2.
  // Clears the flag on first use so navigate-back doesn't re-trigger.
  useEffect(() => {
    if (!location.state?.autoGenerate) return;
    if (!variableModel.model) return;
    navigate(location.pathname, { replace: true, state: {} });
    handleGenerate();
  }, [variableModel.model]);

  // Fallback: auto-generate when model is ready but no questions yet
  // (handles direct navigation / page refresh).
  useEffect(() => {
    if (questions && questions.length > 0) return;
    if (!variableModel.model) return;
    handleGenerate();
  }, [variableModel.model]);

  useEffect(() => {
    // Update chat context for step 3
    updateConversationContext({ currentStep: 3 });
  }, []);

  /**
   * Shared SSE consumer for /api/generate-questions.
   * Appends stage events to narrationStages in real-time,
   * then resolves with the final payload on a "done" event.
   */
  async function runGenerate(body) {
    const res = await fetch("http://localhost:4000/api/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep any incomplete trailing line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event;
        try { event = JSON.parse(raw); } catch { continue; }

        if (event.type === "stage") {
          setNarrationStages((prev) => [
            ...prev,
            { stage: event.stage, message: event.message },
          ]);
        } else if (event.type === "done") {
          finalData = event;
        } else if (event.type === "error") {
          throw new Error(event.message || "Generation failed");
        }
      }
    }

    return finalData;
  }

  async function handleGenerate() {
    if (loading || pendingRef.current) return;
    if (!variableModel.model) {
      showToast("Please generate and approve a variable model first.");
      return;
    }

    pendingRef.current = true;
    setLoading(true);
    setNarrationStages([]);
    setEditingId(null);
    try {
      const data = await runGenerate({ surveyDraft, variableModel: variableModel.model });

      if (data && Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestionsFromAI(data.questions);
        if (data.evaluations) setEvaluations(data.evaluations);
        console.log(data.questions);
        showToast("Questions generated successfully.");
      } else {
        showToast("No questions returned. Using fallback.");
      }
    } catch (err) {
      console.error("Question generation failed:", err);
      showToast("Generation failed — check server logs.");
    } finally {
      setLoading(false);
      setNarrationStages([]);
      pendingRef.current = false;
    }
  }

  async function handleRegenerate() {
    if (loading) return;
    if (!questions || questions.length === 0) {
      showToast("No questions to regenerate.");
      return;
    }

    setLoading(true);
    setNarrationStages([]);
    try {
      const data = await runGenerate({
        surveyDraft: { ...surveyDraft, feedback: "Regenerate with completely different questions" },
        variableModel: variableModel.model,
        previousQuestions: questions,
      });

      if (data && Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestionsFromAI(data.questions);
        if (data.evaluations) setEvaluations(data.evaluations);
        showToast("Questions regenerated successfully.");
      } else {
        showToast("Regeneration failed.");
      }
    } catch (err) {
      console.error("Question regeneration failed:", err);
      showToast("Regeneration failed — check server logs.");
    } finally {
      setLoading(false);
      setNarrationStages([]);
    }
  }

  function handleApprove() {
  if (!questions || questions.length === 0) {
    showToast("Generate questions before approving.");
    return;
  }
  setEditingId(null);
  approveQuestions();
  showToast("Questions approved — Step 4 unlocked.");
}


function commitEdit(index, updatedQuestion) {
  const next = questions.map((q, i) => (i === index ? updatedQuestion : q));
  updateQuestions(next);
}

  function handleDeleteQuestion(index) {
    const next = questions.filter((_, i) => i !== index).map((q, i) => ({
      ...q,
      id: `q${i + 1}`
    }));
    setEditingId(null);
    updateQuestions(next);
    showToast("Question deleted.");
  }

  function handleAddQuestion() {
    const nextId = `q${(questions?.length || 0) + 1}`;
    const newQ = {
      id: nextId,
      text: "",
      type: "multiple_choice",
      variable: "",
      variableRole: "driver",
      options: ["Option 1", "Option 2", "Option 3"],
      required: true,
      branchFrom: null,
      branchCondition: null
    };
    const next = [...(questions || []), newQ];
    updateQuestions(next);
    setEditingId(nextId);
  }

  function handleMoveQuestion(index, direction) {
    if (!questions) return;
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;

    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((q, i) => ({ ...q, id: `q${i + 1}` }));
    updateQuestions(renumbered);

    if (editingId === questions[index].id) {
      setEditingId(renumbered[target].id);
    } else if (editingId === questions[target].id) {
      setEditingId(renumbered[index].id);
    }
  }

  function handleDragStart(index) {
    setDragIndex(index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (index !== dragOverIndex) setDragOverIndex(index);
  }

  function handleDrop(index) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...questions];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    const renumbered = next.map((q, i) => ({ ...q, id: `q${i + 1}` }));

    if (editingId === questions[dragIndex].id) {
      setEditingId(renumbered[index].id);
    }

    updateQuestions(renumbered);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  const tabs = [
    { id: "questions", label: "Questions", icon: <List size={15} /> },
    { id: "preview",   label: "Preview",   icon: <Eye size={15} /> },
    { id: "flow",      label: "Flow",      icon: <Workflow size={15} /> },
  ];

  return (
    <div className="flex gap-4 h-full">
      {/* Main content - Questions */}
      <div className="flex-1 overflow-y-auto space-y-0">

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const disabled = tab.id !== "questions" && (!questions || questions.length === 0);
          return (
            <button
              key={tab.id}
              type="button"
              disabled={disabled}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center justify-between gap-2 px-5 py-3 text-sm font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: isActive ? "#1B6B8A" : "#9ab8c0",
                borderBottom: isActive ? "2px solid #1B6B8A" : "2px solid transparent",
                marginBottom: "-1px",
                backgroundColor: "transparent",
              }}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="pt-5">

        {/* ── Questions tab ── */}
        {activeTab === "questions" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>Survey Questions</h2>
                <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>AI-generated question set</p>
              </div>
              {questions && questions.length > 0 && (
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: "#d0eaea", color: "#1B6B8A" }}>
                  {questions.length} question{questions.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQualityReport(true)}
                disabled={!evaluations || evaluations.length === 0}
                className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200 disabled:opacity-40"
                style={{ borderColor: "#536b6e", color: "#1B6B8A" }}
              >
                Quality Report
              </button>

              <button
                type="button"
                onClick={handleRegenerate}
                disabled={!questions || questions.length === 0 || loading}
                className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200 disabled:opacity-40 flex items-center gap-1.5"
                style={{ borderColor: "#b0d4dc", color: "#1B6B8A" }}
                title="Regenerate questions with improvements"
              >
                <RotateCcw size={13} />
                Regenerate
              </button>

              <button
                type="button"
                onClick={() => setShowModifyModal(true)}
                disabled={!questions || questions.length === 0 || loading}
                className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200 disabled:opacity-40 flex items-center gap-1.5"
                style={{ borderColor: "#5BBF8E", color: "#1B6B8A", backgroundColor: "#f0faf5" }}
                title="Open AI chat to modify questions"
              >
                <Sparkles size={13} />
                Modify
              </button>

              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={!questions}
                className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200 disabled:opacity-40"
                style={{ borderColor: "#b0d4dc", color: "#1B6B8A" }}
                onMouseEnter={e => { if (questions) e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                + Add Question
              </button>
            </div>

            {loading && (
              <div>
                {/* Workflow narration — appears above the spinner */}
                {narrationStages.length > 0 && (
                  <div
                    className="rounded-lg p-4 mb-4 space-y-2"
                    style={{ backgroundColor: "#f0f9fa", border: "1px solid #d0eaea" }}
                  >
                    {narrationStages.map((s, i) => {
                      const isLatest = i === narrationStages.length - 1;
                      return (
                        <div key={i} className="flex items-start gap-2 text-xs font-mono">
                          <span style={{ minWidth: "14px", marginTop: "1px" }}>
                            {isLatest ? (
                              <span
                                className="inline-block w-3 h-3 rounded-full border border-t-transparent animate-spin"
                                style={{ borderColor: "#1B6B8A" }}
                              />
                            ) : (
                              <span style={{ color: "#5BBF8E" }}>✓</span>
                            )}
                          </span>
                          <span>
                            <span className="font-semibold" style={{ color: "#1B6B8A" }}>
                              [Stage: {s.stage}]
                            </span>{" "}
                            <span style={{ color: "#536b6e" }}>{s.message}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Existing spinner — unchanged */}
                <div className="flex items-center gap-2 py-8 justify-center" style={{ color: "#9ab8c0" }}>
                  <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full inline-block" />
                  <span className="text-sm">Generating questions…</span>
                </div>
              </div>
            )}

            {!loading && questions && questions.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {questions.map((q, index) =>
                  editingId === q.id ? (
                    <QuestionEditor
                      key={q.id}
                      question={q}
                      index={index}
                      totalCount={questions.length}
                      allQuestions={questions}
                      onSave={(updated) => { commitEdit(index, updated); setEditingId(null); }}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => handleDeleteQuestion(index)}
                      onMove={(dir) => handleMoveQuestion(index, dir)}
                    />
                  ) : (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={index}
                      isDragging={dragIndex === index}
                      isDragOver={dragOverIndex === index && dragIndex !== index}
                      onEdit={() => setEditingId(q.id)}
                      onDelete={() => handleDeleteQuestion(index)}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                    />
                  )
                )}
              </div>
            )}

            {!loading && (!questions || questions.length === 0) && (
              <div className="rounded-xl border py-12 text-center" style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}>
                <p className="text-sm" style={{ color: "#9ab8c0" }}>No questions yet. Questions will generate automatically.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Preview tab ── */}
        {activeTab === "preview" && questions && questions.length > 0 && (
          <SurveyPreview questions={questions} title={surveyDraft?.title} inline />
        )}

        {showQualityReport && evaluations && evaluations.length > 0 && (
        <QualityReportOverlay
          evaluations={evaluations}
          onClose={() => setShowQualityReport(false)}
        />
        )}
        {/* ── Flow tab ── */}
        {activeTab === "flow" && questions && questions.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#d0eaea", height: "560px" }}>
            <SurveyFlowVisualization questions={questions} />
          </div>
        )}

      </div>
      </div>

      {/* Modify modal */}
      {showModifyModal && (
        <ModifyModal
          questions={questions}
          onApply={(newQs) => {
            setQuestionsFromAI(newQs);
            if (newQs.evaluations) setEvaluations(newQs.evaluations);
            showToast("Survey updated from chat.");
          }}
          onClose={() => setShowModifyModal(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Read-only question card                                           */
/* ------------------------------------------------------------------ */

function QuestionCard({ question: q, isDragging, isDragOver, onEdit, onDelete, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const roleStyle = ROLE_COLORS[q.variableRole] || { bg: "#e8f6f7", text: "#2AABBA" };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="rounded-xl border p-3 group transition-all hover:shadow-md"
      style={{
        borderColor: isDragOver ? "#2AABBA" : "#d0eaea",
        backgroundColor: "#ffffff",
        opacity: isDragging ? 0.4 : 1,
        borderWidth: isDragOver ? "2px" : "1px",
        boxShadow: isDragOver ? "0 0 0 2px #2AABBA33" : undefined,
        cursor: "grab",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className="text-base shrink-0 mt-0.5 select-none"
            style={{ color: "#9ab8c0", cursor: "grab", lineHeight: 1 }}
            title="Drag to reorder"
          >
            ⠿
          </span>
          <span className="text-sm font-semibold" style={{ color: "#1B6B8A" }}>
            {q.id.toUpperCase()}. {q.text}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#e8f6f7", color: "#1B6B8A" }}>
            {TYPE_LABELS[q.type] || q.type}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}>
            {q.variableRole}
          </span>
        </div>
      </div>

      <div className="text-xs mb-1" style={{ color: "#9ab8c0" }}>
        Variable: <span className="font-medium" style={{ color: "#2d6a80" }}>{q.variable}</span>
      </div>

      {q.branchFrom && (
        <div className="text-xs mb-1" style={{ color: "#2AABBA" }}>
          ↳ Branch from {q.branchFrom.toUpperCase()} — {q.branchCondition?.operator} &quot;{
            Array.isArray(q.branchCondition?.value) ? q.branchCondition.value.join(", ") : q.branchCondition?.value
          }&quot;
        </div>
      )}

      {q.options && q.options.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {q.options.map((opt, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f0f8f8", color: "#2d6a80" }}>
              {opt}
            </span>
          ))}
        </div>
      )}

      {q.required === false && (
        <div className="text-[10px] mt-1" style={{ color: "#9ab8c0" }}>Optional</div>
      )}

      <div className="flex gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={onEdit} className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors" style={{ backgroundColor: "#e8f6f7", color: "#1B6B8A" }}>
          Edit
        </button>
        <button type="button" onClick={onDelete} className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
          Delete
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline question editor                                            */
/* ------------------------------------------------------------------ */

function QuestionEditor({ question, index, totalCount, allQuestions, onSave, onCancel, onDelete, onMove }) {
  const [draft, setDraft] = useState({ ...question });

  function set(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleTypeChange(newType) {
    const opts = DEFAULT_OPTIONS[newType] || [];
    setDraft((prev) => ({
      ...prev,
      type: newType,
      options: opts,
      required: newType === "open_ended" ? false : prev.required
    }));
  }

  function handleOptionChange(i, value) {
    const next = [...draft.options];
    next[i] = value;
    set("options", next);
  }

  function handleAddOption() {
    set("options", [...draft.options, ""]);
  }

  function handleRemoveOption(i) {
    set("options", draft.options.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    if (!draft.text.trim()) return;
    onSave(draft);
  }

  const editorInputCls = "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none transition-all duration-200 border-[#b0d4dc] bg-white focus:border-[#2AABBA] focus:ring-2 focus:ring-[#2AABBA]/20";

  return (
    <div className="rounded-xl border-2 p-4 space-y-3" style={{ borderColor: "#2AABBA", backgroundColor: "#f8fdfd" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: "#1B6B8A" }}>{draft.id.toUpperCase()} — Editing</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
            className="text-[11px] px-2 py-1 rounded-lg transition-colors disabled:opacity-30"
            style={{ backgroundColor: "#e8f6f7", color: "#1B6B8A" }} title="Move up">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === totalCount - 1}
            className="text-[11px] px-2 py-1 rounded-lg transition-colors disabled:opacity-30"
            style={{ backgroundColor: "#e8f6f7", color: "#1B6B8A" }} title="Move down">↓</button>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#1B6B8A" }}>Question Text</label>
        <input type="text" value={draft.text} onChange={(e) => set("text", e.target.value)} className={editorInputCls} placeholder="Enter question text…" />
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#1B6B8A" }}>Type</label>
        <select value={draft.type} onChange={(e) => handleTypeChange(e.target.value)} className={editorInputCls}>
          {QUESTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "#1B6B8A" }}>
        <input type="checkbox" checked={draft.required} onChange={(e) => set("required", e.target.checked)} className="rounded" />
        Required
      </label>

      {draft.type !== "open_ended" && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#1B6B8A" }}>Options</label>
          <div className="space-y-1.5">
            {draft.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input type="text" value={opt} onChange={(e) => handleOptionChange(i, e.target.value)}
                  className={editorInputCls} placeholder={`Option ${i + 1}`} />
                <button type="button" onClick={() => handleRemoveOption(i)}
                  className="text-xs font-bold text-red-400 hover:text-red-600 px-1.5">✕</button>
              </div>
            ))}
          </div>
          {draft.type !== "yes_no" && draft.type !== "rating" && (
            <button type="button" onClick={handleAddOption} className="text-[11px] font-semibold mt-1.5" style={{ color: "#2AABBA" }}>
              + Add option
            </button>
          )}
        </div>
      )}

      <BranchEditor
        draft={draft}
        allQuestions={allQuestions}
        currentId={draft.id}
        onChange={(branchFrom, branchCondition) => setDraft((prev) => ({ ...prev, branchFrom, branchCondition }))}
      />

      <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "#d0eaea" }}>
        <button type="button" onClick={handleSave}
          className="text-xs font-bold px-4 py-1.5 rounded-full text-white" style={{ backgroundColor: "#1B6B8A" }}>
          Save
        </button>
        <button type="button" onClick={onCancel}
          className="text-xs font-semibold px-4 py-1.5 rounded-full border" style={{ borderColor: "#b0d4dc", color: "#1B6B8A" }}>
          Cancel
        </button>
        <button type="button" onClick={onDelete}
          className="text-xs font-semibold px-4 py-1.5 rounded-full ml-auto" style={{ color: "#dc2626" }}>
          Delete Question
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Branch condition editor                                           */
/* ------------------------------------------------------------------ */

function BranchEditor({ draft, allQuestions, currentId, onChange }) {
  const hasBranch = !!draft.branchFrom;

  // Questions that appear before the current one (can't branch from yourself or later questions)
  const candidates = allQuestions.filter((q) => q.id !== currentId);

  const parentQuestion = hasBranch
    ? allQuestions.find((q) => q.id === draft.branchFrom)
    : null;

  function handleToggle(enabled) {
    if (enabled && candidates.length > 0) {
      const first = candidates[0];
      onChange(first.id, { questionId: first.id, operator: "equals", value: "" });
    } else {
      onChange(null, null);
    }
  }

  function handleParentChange(questionId) {
    onChange(questionId, { questionId, operator: "equals", value: "" });
  }

  function handleOperatorChange(operator) {
    onChange(draft.branchFrom, {
      ...draft.branchCondition,
      operator
    });
  }

  function handleValueChange(value) {
    onChange(draft.branchFrom, {
      ...draft.branchCondition,
      value
    });
  }

  // For multi-value conditions (equals with multiple options), manage as comma-separated or pick from parent options
  const parentOptions = parentQuestion?.options || [];
  const conditionValue = draft.branchCondition?.value;
  const operator = draft.branchCondition?.operator || "equals";
  const isNumericOp = operator === "gte" || operator === "lte";

  const branchInputCls = "w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition-all border-[#b0d4dc] bg-white focus:border-[#2AABBA] focus:ring-2 focus:ring-[#2AABBA]/20";
  const branchLabelCls = "block text-[10px] font-bold uppercase tracking-wider mb-1";

  return (
    <div className="p-3 rounded-xl border" style={{ borderColor: "#b0d4dc", backgroundColor: "#f0f8f8" }}>
      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none mb-2" style={{ color: "#1B6B8A" }}>
        <input type="checkbox" checked={hasBranch} onChange={(e) => handleToggle(e.target.checked)} className="rounded" />
        Conditional (branching logic)
      </label>

      {hasBranch && (
        <div className="space-y-2 pl-1">
          <div>
            <label className={branchLabelCls} style={{ color: "#1B6B8A" }}>Show when...</label>
            <select value={draft.branchFrom || ""} onChange={(e) => handleParentChange(e.target.value)} className={branchInputCls}>
              {candidates.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id.toUpperCase()} — {q.text ? q.text.slice(0, 50) : "(no text)"}{q.text?.length > 50 ? "…" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={branchLabelCls} style={{ color: "#1B6B8A" }}>Condition</label>
            <select value={operator} onChange={(e) => handleOperatorChange(e.target.value)} className={branchInputCls}>
              {BRANCH_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>
          <div>
            <label className={branchLabelCls} style={{ color: "#1B6B8A" }}>Value</label>
            {isNumericOp ? (
              <input type="text"
                value={typeof conditionValue === "string" ? conditionValue : (Array.isArray(conditionValue) ? conditionValue[0] || "" : "")}
                onChange={(e) => handleValueChange(e.target.value)} className={branchInputCls} placeholder="Numeric value" />
            ) : parentOptions.length > 0 ? (
              <div className="space-y-1">
                {parentOptions.map((opt) => {
                  const selected = Array.isArray(conditionValue) ? conditionValue.includes(opt) : conditionValue === opt;
                  const isMulti = operator === "includes" || operator === "equals" || operator === "not_equals";
                  function toggle() {
                    if (isMulti && (operator === "includes" || (Array.isArray(conditionValue) && conditionValue.length > 0))) {
                      const arr = Array.isArray(conditionValue) ? conditionValue : (conditionValue ? [conditionValue] : []);
                      const next = selected ? arr.filter((v) => v !== opt) : [...arr, opt];
                      handleValueChange(next.length === 1 ? next[0] : next);
                    } else { handleValueChange(opt); }
                  }
                  return (
                    <label key={opt}
                      className="flex items-center gap-2 px-2 py-1 text-xs rounded-lg border cursor-pointer transition-colors"
                      style={selected ? { backgroundColor: "#d0eaea", borderColor: "#2AABBA", color: "#1B6B8A" } : { borderColor: "#d0eaea", color: "#2d6a80" }}
                    >
                      <input type={operator === "includes" ? "checkbox" : "radio"} name={`branch-val-${currentId}`} checked={selected} onChange={toggle} className="rounded" />
                      {opt}
                    </label>
                  );
                })}
              </div>
            ) : (
              <input type="text"
                value={typeof conditionValue === "string" ? conditionValue : (Array.isArray(conditionValue) ? conditionValue.join(", ") : "")}
                onChange={(e) => handleValueChange(e.target.value)} className={branchInputCls} placeholder="Answer value" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Branching logic evaluator                                         */
/* ------------------------------------------------------------------ */

function evaluateBranchCondition(condition, answers) {
  if (!condition) return true;

  const answer = answers[condition.questionId];
  if (answer === undefined || answer === null) return false;

  const { operator, value } = condition;
  const values = Array.isArray(value) ? value : [value];

  switch (operator) {
    case "equals":
      return values.some((v) => {
        if (Array.isArray(answer)) return answer.length === 1 && answer[0] === v;
        return String(answer) === String(v);
      });
    case "not_equals":
      return values.every((v) => {
        if (Array.isArray(answer)) return !(answer.length === 1 && answer[0] === v);
        return String(answer) !== String(v);
      });
    case "includes":
      if (!Array.isArray(answer)) return values.includes(String(answer));
      return values.some((v) => answer.includes(v));
    case "gte": {
      const num = parseFloat(String(answer).replace(/[^0-9.]/g, ""));
      return !isNaN(num) && num >= parseFloat(String(values[0]));
    }
    case "lte": {
      const num = parseFloat(String(answer).replace(/[^0-9.]/g, ""));
      return !isNaN(num) && num <= parseFloat(String(values[0]));
    }
    default:
      return true;
  }
}

function getVisibleQuestions(questions, answers) {
  return questions.filter((q) => {
    if (!q.branchFrom || !q.branchCondition) return true;
    return evaluateBranchCondition(q.branchCondition, answers);
  });
}

function QualityReportOverlay({ evaluations, onClose }) {
  const totalScore = evaluations.reduce((sum, e) => {
    const rel = (e.llm_scores.relevance / 5) * 25;
    const clarity = (e.llm_scores.clarity / 5) * 25;
    const neutrality = (e.llm_scores.neutrality / 5) * 25;
    const answerability = (e.llm_scores.answerability / 5) * 25;
    const dupPenalty = e.max_duplicate_similarity > 0.85 ? -10 : 0;
    const rulePenalty = e.rule_violations.length * -5;
    return sum + rel + clarity + neutrality + answerability + dupPenalty + rulePenalty;
  }, 0);

  const avgScore = Math.min(100, Math.max(0, Math.round(totalScore / evaluations.length)));

  const scoreColor = avgScore >= 80 ? "#5BBF8E" : avgScore >= 60 ? "#f59e0b" : "#dc2626";
  const scoreLabel = avgScore >= 80 ? "Good" : avgScore >= 60 ? "Needs Improvement" : "Poor";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="h-1 w-full" style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }} />
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#d0eaea" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1B6B8A" }}>Quality Report</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9ab8c0" }}>{evaluations.length} questions evaluated</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold" style={{ color: scoreColor }}>{avgScore}/100</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}>
                {scoreLabel}
              </span>
            </div>
            <button type="button" onClick={onClose}
              className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
              style={{ backgroundColor: "#1B6B8A" }}>
              Close
            </button>
          </div>
        </div>

        {/* Questions */}
        <div className="px-6 py-5 space-y-3" style={{ backgroundColor: "#f0f8f8" }}>
          {evaluations.map((e, i) => {
            const issues = [];
            if (e.llm_scores.relevance < 4) issues.push(`Low relevance (${e.llm_scores.relevance}/5)`);
            if (e.llm_scores.clarity < 4) issues.push(`Low clarity (${e.llm_scores.clarity}/5)`);
            if (e.llm_scores.neutrality < 4) issues.push(`Possible bias (${e.llm_scores.neutrality}/5)`);
            if (e.llm_scores.answerability < 4) issues.push(`Hard to answer (${e.llm_scores.answerability}/5)`);
            if (e.rule_violations.includes("multiple_questions")) issues.push("Contains multiple questions");
            if (e.rule_violations.includes("too_long")) issues.push("Question too long");
            if (e.rule_violations.includes("double_negative")) issues.push("Double negative");
            if (e.rule_violations.includes("vague_language")) issues.push("Vague language");
            if (e.rule_violations.includes("leading_language")) issues.push("Leading language");
            if (e.max_duplicate_similarity > 0.85) issues.push("Too similar to another question");
            if (e.response_option_issues?.length > 0) issues.push("Response option issues");
            if (e.skip_logic_issue) issues.push("Branch logic issue");
            if (e.response_scale_issue) issues.push("Scale inconsistency");

            const isOk = issues.length === 0;

            return (
              <div key={i} className="rounded-xl border bg-white p-4"
                style={{ borderColor: isOk ? "#5BBF8E" : "#f59e0b" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold" style={{ color: "#1B6B8A" }}>{e.question}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: isOk ? "#e8faf2" : "#fef9ee", color: isOk ? "#5BBF8E" : "#f59e0b" }}>
                    {isOk ? "✓ OK" : `${issues.length} issue${issues.length > 1 ? "s" : ""}`}
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] flex-wrap mb-1" style={{ color: "#9ab8c0" }}>
                  <span>Relevance: {e.llm_scores.relevance}/5</span>
                  <span>Clarity: {e.llm_scores.clarity}/5</span>
                  <span>Neutrality: {e.llm_scores.neutrality}/5</span>
                  <span>Var match: {(e.variable_relevance * 100).toFixed(0)}%</span>
                  <span>Readability: {e.readability}</span>
                </div>
                {issues.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {issues.map((issue, j) => (
                      <li key={j} className="text-[11px]" style={{ color: "#b45309" }}>⚠️ {issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Survey preview (interactive, with branching)                      */
/* ------------------------------------------------------------------ */

function SurveyPreview({ questions, title, inline }) {
  const [answers, setAnswers] = useState({});
  const visible = getVisibleQuestions(questions, answers);

  function setAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleMulti(questionId, option) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
  }

  const header = (
    <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#d0eaea" }}>
      <div>
        <h2 className="text-base font-bold" style={{ color: "#1B6B8A" }}>{title || "Survey Preview"}</h2>
        <p className="text-xs mt-0.5" style={{ color: "#9ab8c0" }}>{visible.length} of {questions.length} questions visible</p>
      </div>
      <button type="button" onClick={() => setAnswers({})}
        className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
        style={{ borderColor: "#b0d4dc", color: "#1B6B8A" }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
        Reset
      </button>
    </div>
  );

  const body = (
    <div className="px-6 py-5 space-y-4" style={{ backgroundColor: "#f0f8f8" }}>
      {visible.map((q) => (
        <PreviewCard key={q.id} question={q} answer={answers[q.id]}
          onAnswer={(val) => setAnswer(q.id, val)} onToggleMulti={(opt) => toggleMulti(q.id, opt)} />
      ))}
    </div>
  );

  if (inline) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#d0eaea" }}>
        <div className="h-1 w-full" style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }} />
        {header}
        {body}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="h-1 w-full" style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }} />
        {header}
        {body}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual preview card (respondent-facing)                       */
/* ------------------------------------------------------------------ */

function PreviewCard({ question: q, answer, onAnswer, onToggleMulti }) {
  const multiSelected = Array.isArray(answer) ? answer : [];

  const selectedStyle = { backgroundColor: "#d0eaea", borderColor: "#2AABBA", color: "#1B6B8A" };
  const defaultStyle  = { borderColor: "#d0eaea", color: "#2d6a80" };

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: "#d0eaea" }}>
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-bold mt-0.5 shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "#e8f6f7", color: "#1B6B8A" }}>
          {q.id.toUpperCase()}
        </span>
        <span className="text-sm font-medium" style={{ color: "#1B6B8A" }}>
          {q.text}{q.required && <span className="text-red-400 ml-0.5">*</span>}
        </span>
      </div>

      {q.type === "likert" && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => (
            <button key={opt} type="button" onClick={() => onAnswer(opt)}
              className="px-3 py-1.5 text-xs rounded-full border transition-colors"
              style={answer === opt ? selectedStyle : defaultStyle}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.type === "multiple_choice" && (
        <div className="space-y-1.5">
          {q.options.map((opt) => (
            <button key={opt} type="button" onClick={() => onAnswer(opt)}
              className="w-full text-left px-3 py-2 text-xs rounded-lg border transition-colors"
              style={answer === opt ? selectedStyle : defaultStyle}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.type === "multi_select" && (
        <div className="space-y-1.5">
          <p className="text-[10px] mb-1" style={{ color: "#9ab8c0" }}>Select all that apply</p>
          {q.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg border cursor-pointer transition-colors"
              style={multiSelected.includes(opt) ? selectedStyle : defaultStyle}>
              <input type="checkbox" checked={multiSelected.includes(opt)} onChange={() => onToggleMulti(opt)} className="rounded" />
              {opt}
            </label>
          ))}
        </div>
      )}

      {q.type === "yes_no" && (
        <div className="flex gap-3">
          {q.options.map((opt) => (
            <button key={opt} type="button" onClick={() => onAnswer(opt)}
              className="flex-1 px-4 py-2 text-sm font-semibold rounded-full border transition-colors"
              style={answer === opt ? { ...selectedStyle, backgroundColor: "#1B6B8A", color: "white" } : defaultStyle}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.type === "rating" && (
        <div className="flex flex-wrap gap-1.5">
          {q.options.map((opt) => (
            <button key={opt} type="button" onClick={() => onAnswer(opt)}
              className="w-9 h-9 text-xs font-bold rounded-full border transition-colors"
              style={answer === opt ? { backgroundColor: "#1B6B8A", borderColor: "#1B6B8A", color: "white" } : defaultStyle}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.type === "open_ended" && (
        <textarea value={answer || ""} onChange={(e) => onAnswer(e.target.value)} rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none transition-all border-[#b0d4dc] focus:border-[#2AABBA] focus:ring-2 focus:ring-[#2AABBA]/20"
          placeholder="Type your answer here…" />
      )}

      {q.branchFrom && (
        <div className="text-[10px] mt-2" style={{ color: "#2AABBA" }}>
          ↳ Shown based on {q.branchFrom.toUpperCase()} answer
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modify modal — chat + questions preview side-by-side               */
/* ------------------------------------------------------------------ */

function ModifyModal({ questions, onApply, onClose }) {
  const { messages, isLoading, error, sendChatMessage, conversationContext } = useChat();
  const { surveyDraft, variableModel, evaluations } = useSurvey();

  const [input, setInput] = useState("");
  const [draftQuestions, setDraftQuestions] = useState(null);
  const [activeTab, setActiveTab] = useState("changes");
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const displayQuestions = draftQuestions || questions;
  const hasChanges = !!draftQuestions;

  // For change-badge comparison
  const originalIds = new Set((questions || []).map((q) => q.id));
  const originalTextMap = Object.fromEntries((questions || []).map((q) => [q.id, q.text]));

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const userInput = input.trim();
    setInput("");

    const response = await sendChatMessage(userInput, {
      currentStep: conversationContext.currentStep,
      surveyDraft,
      variableModel: variableModel?.model,
      questions: draftQuestions || questions,
      evaluations,
    });

    if (response?.regeneratedQuestions) {
      setDraftQuestions(response.regeneratedQuestions);
    }
  }

  function handleApply() {
    if (draftQuestions) onApply(draftQuestions);
    onClose();
  }

  const QUICK_PROMPTS = [
    "Make the questions simpler",
    "Add a demographics question",
    "Make questions more neutral",
    "Remove any duplicate questions",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "90vw", height: "86vh", maxWidth: "1200px" }}
      >
        {/* ── Top bar ── */}
        <div
          className="flex items-center justify-between px-6 py-3 border-b shrink-0"
          style={{ borderColor: "#d0eaea", backgroundColor: "#f0f9fa" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #5BBF8E, #1B6B8A)" }}
            >
              <Sparkles size={12} color="white" />
            </div>
            <span className="text-sm font-bold" style={{ color: "#1B6B8A" }}>Survey AI</span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#d0eaea", color: "#1B6B8A" }}
            >
              Beta
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{ color: "#536b6e" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Chat panel ── */}
          <div
            className="flex flex-col border-r shrink-0"
            style={{ width: "360px", borderColor: "#d0eaea" }}
          >
            {/* Revert banner — only when changes are pending */}
            {hasChanges && (
              <div
                className="flex items-center justify-between px-4 py-2 border-b shrink-0"
                style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}
              >
                <button
                  onClick={() => setDraftQuestions(null)}
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  style={{ color: "#536b6e" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#1B6B8A"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#536b6e"; }}
                >
                  <RotateCcw size={11} />
                  Back to this version
                </button>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#e8faf2", color: "#5BBF8E" }}
                >
                  Changes pending
                </span>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                    style={{ backgroundColor: "#e8f6f7" }}
                  >
                    <MessageSquare size={20} style={{ color: "#1B6B8A" }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "#1B6B8A" }}>
                    What would you like to change?
                  </p>
                  <p className="text-xs" style={{ color: "#9ab8c0" }}>
                    Ask me to add, remove, or improve questions. Changes preview on the right.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <ModalChatMessage key={msg.id} message={msg} />
                  ))}
                  {isLoading && (
                    <div className="flex items-start gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "linear-gradient(135deg, #5BBF8E, #1B6B8A)" }}
                      >
                        <Sparkles size={12} color="white" />
                      </div>
                      <div
                        className="px-3 py-2 rounded-xl rounded-tl-none text-xs flex items-center gap-2"
                        style={{ backgroundColor: "#f0f9fa", color: "#536b6e" }}
                      >
                        <Loader size={12} className="animate-spin" />
                        Thinking…
                      </div>
                    </div>
                  )}
                  {error && (
                    <div
                      className="text-xs px-3 py-2 rounded-lg"
                      style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}
                    >
                      {error}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Quick prompts — only when chat is empty */}
            {messages.length === 0 && (
              <div
                className="px-4 py-3 border-t space-y-1.5 shrink-0"
                style={{ borderColor: "#d0eaea" }}
              >
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="flex w-full items-center text-left px-3 py-2 rounded-lg text-xs transition-colors"
                    style={{ color: "#1B6B8A", backgroundColor: "#f0f9fa" }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#d0eaea"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#f0f9fa"; }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div
              className="border-t px-4 py-3 shrink-0"
              style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}
            >
              <form onSubmit={handleSend} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none transition-all disabled:opacity-50"
                  style={{ borderColor: "#b0d4dc", color: "#1B6B8A", backgroundColor: "#ffffff" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#2AABBA"; e.currentTarget.style.boxShadow = "0 0 0 2px #2AABBA20"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#b0d4dc"; e.currentTarget.style.boxShadow = "none"; }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                  style={{ backgroundColor: "#1B6B8A", color: "white" }}
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>

          {/* ── Right: Questions preview ── */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: "#f8fdfd" }}>

            {/* Tabs + question count */}
            <div
              className="flex items-center justify-between px-6 py-3 border-b shrink-0 bg-white"
              style={{ borderColor: "#d0eaea" }}
            >
              <div className="flex gap-1">
                {[
                  { id: "changes", label: "Suggested changes" },
                  { id: "preview", label: "Preview" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                    style={
                      activeTab === tab.id
                        ? { backgroundColor: "#d0eaea", color: "#1B6B8A" }
                        : { color: "#9ab8c0", backgroundColor: "transparent" }
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#d0eaea", color: "#1B6B8A" }}
              >
                {displayQuestions.length} question{displayQuestions.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {activeTab === "changes" && displayQuestions.map((q, i) => {
                const isNew = hasChanges && !originalIds.has(q.id);
                const isModified = hasChanges && !isNew && originalTextMap[q.id] !== undefined && originalTextMap[q.id] !== q.text;
                return (
                  <ModalQuestionCard
                    key={q.id}
                    question={q}
                    number={i + 1}
                    isNew={isNew}
                    isModified={isModified}
                  />
                );
              })}
              {activeTab === "preview" && (
                <SurveyPreview questions={displayQuestions} title={surveyDraft?.title} inline />
              )}
            </div>

            {/* Footer: Cancel + Apply */}
            <div
              className="border-t px-6 py-4 flex items-center justify-end gap-3 bg-white shrink-0"
              style={{ borderColor: "#d0eaea" }}
            >
              <button
                onClick={onClose}
                className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors"
                style={{ borderColor: "#b0d4dc", color: "#536b6e" }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!hasChanges}
                className="text-xs font-bold px-6 py-2 rounded-full text-white transition-all disabled:opacity-40"
                style={{ backgroundColor: "#1B6B8A" }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat message bubble inside the modal                               */
/* ------------------------------------------------------------------ */

function ModalChatMessage({ message }) {
  const isUser = message.role === "user";
  const hasUpdated = message.metadata?.action === "questions_regenerated";

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "linear-gradient(135deg, #5BBF8E, #1B6B8A)" }}
        >
          <Sparkles size={12} color="white" />
        </div>
      )}
      <div
        className={`max-w-[78%] px-3 py-2.5 rounded-xl text-xs leading-relaxed ${
          isUser ? "rounded-tr-none" : "rounded-tl-none"
        }`}
        style={
          isUser
            ? { backgroundColor: "#1B6B8A", color: "white" }
            : { backgroundColor: "#f0f9fa", color: "#1B6B8A" }
        }
      >
        {message.content}
        {hasUpdated && (
          <div
            className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold"
            style={{ color: isUser ? "rgba(255,255,255,0.7)" : "#5BBF8E" }}
          >
            <span>✓</span>
            <span>Questions updated — preview on the right</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Question card inside the modal preview panel                       */
/* ------------------------------------------------------------------ */

function ModalQuestionCard({ question: q, number, isNew, isModified }) {
  const badge = isNew
    ? { label: "New", bg: "#e8faf2", text: "#5BBF8E" }
    : isModified
    ? { label: "Modified", bg: "#fef9ee", text: "#f59e0b" }
    : null;

  return (
    <div
      className="rounded-xl border bg-white p-4 transition-all"
      style={{
        borderColor: isNew ? "#5BBF8E" : isModified ? "#f59e0b" : "#d0eaea",
        borderWidth: isNew || isModified ? "1.5px" : "1px",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Number badge */}
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
          style={{ backgroundColor: "#e8f6f7", color: "#1B6B8A" }}
        >
          {number}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium leading-snug" style={{ color: "#1B6B8A" }}>
              {q.text}
            </p>
            {badge && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: badge.bg, color: badge.text }}
              >
                {badge.label}
              </span>
            )}
          </div>

          {/* Options */}
          {q.options && q.options.length > 0 && (
            <div className="space-y-1">
              {q.options.slice(0, 5).map((opt, i) => (
                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "#536b6e" }}>
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: "#f0f8f8", color: "#2AABBA" }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </div>
              ))}
              {q.options.length > 5 && (
                <p className="text-[10px] pl-7" style={{ color: "#9ab8c0" }}>
                  +{q.options.length - 5} more options
                </p>
              )}
            </div>
          )}

          {q.type === "open_ended" && (
            <div
              className="mt-1 h-7 rounded-lg border flex items-center px-2 text-[10px]"
              style={{ borderColor: "#d0eaea", color: "#9ab8c0", borderStyle: "dashed" }}
            >
              Open text response…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Step3Questions;
