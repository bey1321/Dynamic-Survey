import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";
import { useToast } from "../state/ToastContext";

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
  dependent: "bg-blue-100 text-blue-800",
  driver: "bg-amber-100 text-amber-800",
  control: "bg-slate-100 text-slate-600"
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
    approveQuestions,
    completeQualityCheck,
    setEvaluations
  } = useSurvey();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const navigate = useNavigate();

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

  async function handleQualityCheck() {
  if (!questions || questions.length === 0) {
    showToast("Generate questions first before running quality check.");
    return;
  }

  setEvaluating(true);
  try {
    const res = await fetch("http://localhost:4000/api/evaluate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions,
        topic: surveyDraft?.goal || surveyDraft?.title || "general survey"
      })
    });
    const data = await res.json();

    if (data.evaluations) {
    setEvaluations(data.evaluations);
    completeQualityCheck();
    showToast("Quality check complete — see Step 4.");
    navigate("/step/4-audit"); 
    } else {
      showToast("Quality check failed — no results returned.");
    }
  } catch (err) {
    console.error("Quality check failed:", err);
    showToast("Quality check failed — check server logs.");
  } finally {
    setEvaluating(false);
  }
}

function handleStub() {
  showToast("Not implemented in this prototype – handled by another team.");
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

  return (
    <div className="space-y-4">
      <div className="mono-block inline-block mb-2">
        {isApproved
          ? `[Generated Questions v${questionsState.approvedVersion}]`
          : "[Generated Questions – Draft]"}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-primary text-white disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate Questions"}
        </button>
        <button
          type="button"
          onClick={handleQualityCheck}
          disabled={evaluating || !questions || questions.length === 0}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-slate-800 text-white disabled:opacity-50"
        >
          {evaluating ? "Checking…" : "Run Quality Check"}
        </button>
        <button
          type="button"
          onClick={handleStub}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded border border-slate-300 text-slate-700"
        >
          Run Simulation
        </button>
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          disabled={!questions || questions.length === 0}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-violet-600 text-white disabled:opacity-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={handleAddQuestion}
          disabled={!questions}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded border border-slate-300 text-slate-700 disabled:opacity-50"
        >
          + Add Question
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={!questions || questions.length === 0}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-emerald-600 text-white disabled:opacity-50"
        >
          Approve Draft
        </button>
      </div>

      {/* Questions list */}
      {loading && (
        <div className="text-sm text-slate-500 py-6">Generating questions via Gemini…</div>
      )}

      {!loading && questions && questions.length > 0 && (
        <div className="space-y-3 mt-2">
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
        <div className="text-sm text-slate-400 py-6">
          No questions generated yet. Click &quot;Generate Questions&quot; to start.
        </div>
      )}

      {/* Preview overlay */}
      {previewing && questions && questions.length > 0 && (
        <SurveyPreview
          questions={questions}
          title={surveyDraft.title}
          onClose={() => setPreviewing(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Read-only question card                                           */
/* ------------------------------------------------------------------ */

function QuestionCard({ question: q, onEdit, onDelete }) {
  return (
    <div className="card p-4 group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-sm font-semibold text-slate-900">
          {q.id.toUpperCase()}. {q.text}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-violet-100 text-violet-700">
            {TYPE_LABELS[q.type] || q.type}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[q.variableRole] || "bg-slate-100 text-slate-600"}`}>
            {q.variableRole}
          </span>
        </div>
      </div>

      <div className="text-xs text-slate-500 mb-1">
        Variable: <span className="font-medium text-slate-700">{q.variable}</span>
      </div>

      {q.branchFrom && (
        <div className="text-xs text-indigo-500 mb-1">
          Branch from {q.branchFrom.toUpperCase()} — {q.branchCondition?.operator} &quot;{
            Array.isArray(q.branchCondition?.value)
              ? q.branchCondition.value.join(", ")
              : q.branchCondition?.value
          }&quot;
        </div>
      )}

      {q.options && q.options.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {q.options.map((opt, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
            >
              {opt}
            </span>
          ))}
        </div>
      )}

      {q.required === false && (
        <div className="text-[10px] text-slate-400 mt-1">Optional</div>
      )}

      {/* Hover actions */}
      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
        >
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

  return (
    <div className="card p-4 border-blue-300 ring-1 ring-blue-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-blue-700">{draft.id.toUpperCase()} — Editing</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === totalCount - 1}
            className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
        </div>
      </div>

      {/* Question text */}
      <label className="block text-[11px] font-medium text-slate-500 mb-1">Question Text</label>
      <input
        type="text"
        value={draft.text}
        onChange={(e) => set("text", e.target.value)}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-blue-300"
        placeholder="Enter question text…"
      />

      {/* Type selector */}
      <div className="mb-3">
        <label className="block text-[11px] font-medium text-slate-500 mb-1">Type</label>
        <select
          value={draft.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Required toggle */}
      <label className="flex items-center gap-2 text-xs text-slate-600 mb-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(e) => set("required", e.target.checked)}
          className="rounded border-slate-300"
        />
        Required
      </label>

      {/* Options editor (hidden for open_ended) */}
      {draft.type !== "open_ended" && (
        <div className="mb-3">
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Options
          </label>
          <div className="space-y-1.5">
            {draft.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                  placeholder={`Option ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(i)}
                  className="text-[11px] px-1.5 py-0.5 rounded text-red-500 hover:bg-red-50"
                  title="Remove option"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {draft.type !== "yes_no" && draft.type !== "rating" && (
            <button
              type="button"
              onClick={handleAddOption}
              className="text-[11px] text-blue-600 hover:underline mt-1.5"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      {/* Branching logic editor */}
      <BranchEditor
        draft={draft}
        allQuestions={allQuestions}
        currentId={draft.id}
        onChange={(branchFrom, branchCondition) =>
          setDraft((prev) => ({ ...prev, branchFrom, branchCondition }))
        }
      />

      {/* Save / Cancel / Delete */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="px-3 py-1.5 text-xs font-medium rounded text-red-600 hover:bg-red-50 ml-auto"
        >
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

  return (
    <div className="mb-3 p-3 rounded border border-indigo-200 bg-indigo-50/50">
      <label className="flex items-center gap-2 text-xs font-medium text-indigo-700 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hasBranch}
          onChange={(e) => handleToggle(e.target.checked)}
          className="rounded border-indigo-300"
        />
        Conditional (branching logic)
      </label>

      {hasBranch && (
        <div className="space-y-2 pl-1">
          {/* Parent question selector */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Show this question when...</label>
            <select
              value={draft.branchFrom || ""}
              onChange={(e) => handleParentChange(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
            >
              {candidates.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id.toUpperCase()} — {q.text ? q.text.slice(0, 50) : "(no text)"}
                  {q.text && q.text.length > 50 ? "…" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Operator selector */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Condition</label>
            <select
              value={operator}
              onChange={(e) => handleOperatorChange(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
            >
              {BRANCH_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>

          {/* Value input */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Value</label>
            {isNumericOp ? (
              <input
                type="text"
                value={typeof conditionValue === "string" ? conditionValue : (Array.isArray(conditionValue) ? conditionValue[0] || "" : "")}
                onChange={(e) => handleValueChange(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                placeholder="Numeric value (e.g. 2)"
              />
            ) : parentOptions.length > 0 ? (
              <div className="space-y-1">
                {parentOptions.map((opt) => {
                  const selected = Array.isArray(conditionValue)
                    ? conditionValue.includes(opt)
                    : conditionValue === opt;
                  const isMulti = operator === "includes" || operator === "equals" || operator === "not_equals";

                  function toggle() {
                    if (isMulti && (operator === "includes" || (Array.isArray(conditionValue) && conditionValue.length > 0))) {
                      // Multi-value: toggle in array
                      const arr = Array.isArray(conditionValue) ? conditionValue : (conditionValue ? [conditionValue] : []);
                      const next = selected
                        ? arr.filter((v) => v !== opt)
                        : [...arr, opt];
                      handleValueChange(next.length === 1 ? next[0] : next);
                    } else {
                      // Single value
                      handleValueChange(opt);
                    }
                  }

                  return (
                    <label
                      key={opt}
                      className={`flex items-center gap-2 px-2 py-1 text-xs rounded border cursor-pointer transition-colors ${
                        selected
                          ? "bg-indigo-100 border-indigo-400 text-indigo-800"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type={operator === "includes" ? "checkbox" : "radio"}
                        name={`branch-val-${currentId}`}
                        checked={selected}
                        onChange={toggle}
                        className="rounded border-slate-300"
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                value={typeof conditionValue === "string" ? conditionValue : (Array.isArray(conditionValue) ? conditionValue.join(", ") : "")}
                onChange={(e) => handleValueChange(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                placeholder="Answer value"
              />
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {title || "Survey Preview"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {visible.length} of {questions.length} questions visible
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAnswers({})}
              className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              Reset Answers
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700"
            >
              Close Preview
            </button>
          </div>
        </div>

        {/* Questions */}
        <div className="px-6 py-5 space-y-4">
          {visible.map((q) => (
            <PreviewCard
              key={q.id}
              question={q}
              answer={answers[q.id]}
              onAnswer={(val) => setAnswer(q.id, val)}
              onToggleMulti={(opt) => toggleMulti(q.id, opt)}
            />
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

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-bold text-slate-400 mt-0.5 shrink-0">
          {q.id.toUpperCase()}
        </span>
        <span className="text-sm font-medium text-slate-900">
          {q.text}
          {q.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </div>

      {/* Likert */}
      {q.type === "likert" && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(opt)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                answer === opt
                  ? "bg-primary text-white border-primary"
                  : "border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Multiple choice */}
      {q.type === "multiple_choice" && (
        <div className="space-y-1.5">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(opt)}
              className={`w-full text-left px-3 py-2 text-xs rounded border transition-colors ${
                answer === opt
                  ? "bg-blue-50 border-blue-400 text-blue-800"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Multi select */}
      {q.type === "multi_select" && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-400 mb-1">Select all that apply</p>
          {q.options.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs rounded border cursor-pointer transition-colors ${
                multiSelected.includes(opt)
                  ? "bg-blue-50 border-blue-400 text-blue-800"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                checked={multiSelected.includes(opt)}
                onChange={() => onToggleMulti(opt)}
                className="rounded border-slate-300"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {/* Yes / No */}
      {q.type === "yes_no" && (
        <div className="flex gap-3">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(opt)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded border transition-colors ${
                answer === opt
                  ? "bg-primary text-white border-primary"
                  : "border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Rating 1-10 */}
      {q.type === "rating" && (
        <div className="flex flex-wrap gap-1.5">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(opt)}
              className={`w-9 h-9 text-xs font-medium rounded-full border transition-colors ${
                answer === opt
                  ? "bg-primary text-white border-primary"
                  : "border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Open ended */}
      {q.type === "open_ended" && (
        <textarea
          value={answer || ""}
          onChange={(e) => onAnswer(e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
          placeholder="Type your answer here…"
        />
      )}

      {/* Branch indicator */}
      {q.branchFrom && (
        <div className="text-[10px] text-indigo-400 mt-2">
          Shown based on {q.branchFrom.toUpperCase()} answer
        </div>
      )}
    </div>
  );
}

export default Step3Questions;
