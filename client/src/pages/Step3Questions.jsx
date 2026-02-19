import { useState } from "react";
import { useSurvey } from "../state/SurveyContext";
import { useToast } from "../state/ToastContext";

const TYPE_LABELS = {
  likert: "Likert",
  multiple_choice: "Multiple Choice",
  multi_select: "Multi-Select",
  yes_no: "Yes / No",
  open_ended: "Open-Ended",
  rating: "Rating (1–10)"
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
    approveQuestions
  } = useSurvey();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const questions = questionsState.questions;
  const isApproved = questionsState.approvedVersion > 0;

  async function handleGenerate() {
    if (!variableModel.model) {
      showToast("Please generate and approve a variable model first.");
      return;
    }

    setLoading(true);
    setEditingId(null);
    try {
      const res = await fetch("http://localhost:4000/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyDraft,
          variableModel: variableModel.model
        })
      });
      const data = await res.json();

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestionsFromAI(data.questions);
        showToast("Questions generated successfully.");
      } else {
        showToast("No questions returned. Using fallback.");
      }
    } catch (err) {
      console.error("Question generation failed:", err);
      showToast("Generation failed — check server logs.");
    } finally {
      setLoading(false);
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

  function handleStub() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  /* ---- Editing helpers ---- */

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>Generate Questions</h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>
            {isApproved ? `Approved — v${questionsState.approvedVersion}` : "Draft — not yet approved"}
          </p>
        </div>
        {questions && questions.length > 0 && (
          <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: "#d0eaea", color: "#1B6B8A" }}>
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Action toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full text-white transition-colors duration-200 disabled:opacity-50"
          style={{ backgroundColor: "#1B6B8A" }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = "#2AABBA"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}
        >
          {loading ? "Generating…" : "Generate Questions"}
        </button>
        <button
          type="button"
          onClick={handleStub}
          className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200"
          style={{ borderColor: "#2AABBA", color: "#1B6B8A" }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          Quality Check
        </button>
        <button
          type="button"
          onClick={handleStub}
          className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200"
          style={{ borderColor: "#2AABBA", color: "#1B6B8A" }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          Simulation
        </button>
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          disabled={!questions || questions.length === 0}
          className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200 disabled:opacity-40"
          style={{ borderColor: "#5BBF8E", color: "#2d8c5e" }}
          onMouseEnter={e => { if (questions?.length) e.currentTarget.style.backgroundColor = "#f0faf5"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          Preview
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
        <button
          type="button"
          onClick={handleApprove}
          disabled={!questions || questions.length === 0}
          className="ml-auto flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full text-white transition-colors duration-200 disabled:opacity-40"
          style={{ backgroundColor: "#5BBF8E" }}
          onMouseEnter={e => { if (questions?.length) e.currentTarget.style.backgroundColor = "#3ea873"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#5BBF8E"; }}
        >
          Approve Draft
        </button>
      </div>

      {/* Questions list */}
      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center" style={{ color: "#9ab8c0" }}>
          <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full inline-block" />
          <span className="text-sm">Generating questions…</span>
        </div>
      )}

      {!loading && questions && questions.length > 0 && (
        <div className="space-y-3">
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
                onEdit={() => setEditingId(q.id)}
                onDelete={() => handleDeleteQuestion(index)}
              />
            )
          )}
        </div>
      )}

      {!loading && (!questions || questions.length === 0) && (
        <div className="rounded-xl border py-12 text-center" style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}>
          <p className="text-sm" style={{ color: "#9ab8c0" }}>No questions yet. Click &quot;Generate Questions&quot; to start.</p>
        </div>
      )}

      {previewing && questions && questions.length > 0 && (
        <SurveyPreview questions={questions} title={surveyDraft.title} onClose={() => setPreviewing(false)} />
      
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Read-only question card                                           */
/* ------------------------------------------------------------------ */

function QuestionCard({ question: q, onEdit, onDelete }) {
  const roleStyle = ROLE_COLORS[q.variableRole] || { bg: "#e8f6f7", text: "#2AABBA" };
  return (
    <div className="rounded-xl border p-4 group transition-shadow hover:shadow-md" style={{ borderColor: "#d0eaea", backgroundColor: "#ffffff" }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-sm font-semibold" style={{ color: "#1B6B8A" }}>
          {q.id.toUpperCase()}. {q.text}
        </span>
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

      <div className="flex gap-2 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

/* ------------------------------------------------------------------ */
/*  Survey preview (interactive, with branching)                      */
/* ------------------------------------------------------------------ */

function SurveyPreview({ questions, title, onClose }) {
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

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="h-1 w-full" style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }} />
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#d0eaea" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1B6B8A" }}>{title || "Survey Preview"}</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9ab8c0" }}>{visible.length} of {questions.length} questions visible</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAnswers({})}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
              style={{ borderColor: "#b0d4dc", color: "#1B6B8A" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
              Reset
            </button>
            <button type="button" onClick={onClose}
              className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
              style={{ backgroundColor: "#1B6B8A" }}>
              Close
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4" style={{ backgroundColor: "#f0f8f8" }}>
          {visible.map((q) => (
            <PreviewCard key={q.id} question={q} answer={answers[q.id]}
              onAnswer={(val) => setAnswer(q.id, val)} onToggleMulti={(opt) => toggleMulti(q.id, opt)} />
          ))}
        </div>
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

export default Step3Questions;
