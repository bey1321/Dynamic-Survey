import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";
import { QUALITY_THRESHOLDS } from "../../../shared/constants.js";

// Helper to interpret Flesch Reading Ease score
function readabilityLevel(score) {
  if (score >= 90) return "Very Easy";
  if (score >= 80) return "Easy";
  if (score >= 70) return "Fairly Easy";
  if (score >= 60) return "Standard";
  if (score >= 50) return "Fairly Difficult";
  if (score >= 30) return "Difficult";
  return "Very Difficult";
}

function Step4Audit() {
  const { evaluations, hasEvaluationIssues, setEvaluations, surveyDraft, variableModel, setQuestionsFromAI } = useSurvey();
  const navigate = useNavigate();
  const [regenerating, setRegenerating] = useState(false);

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mono-block inline-block mb-2">[Quality Check (Bias + Validity)]</div>
        <div className="text-sm text-slate-400 py-6">
          No quality check results yet. Go to Step 3 and click &quot;Run Quality Check&quot;.
        </div>
      </div>
    );
  }

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

  const hasIssues = hasEvaluationIssues(QUALITY_THRESHOLDS);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const feedback = evaluations
        .filter((e) =>
        e.llm_scores.relevance < QUALITY_THRESHOLDS.minLLM ||
        e.llm_scores.clarity   < QUALITY_THRESHOLDS.minLLM ||
        e.llm_scores.neutrality < QUALITY_THRESHOLDS.minLLM ||
        e.variable_relevance < QUALITY_THRESHOLDS.minVariableRelevance ||
        e.max_duplicate_similarity > QUALITY_THRESHOLDS.maxDuplicate ||
        e.rule_violations.length > 0 ||
        (e.response_option_issues?.length ?? 0) > 0 ||
        e.skip_logic_issue ||
        e.response_scale_issue
      )
        .map((e) => {
          const problems = [];
          if (e.llm_scores.relevance < QUALITY_THRESHOLDS.minLLM) problems.push(`low relevance (${e.llm_scores.relevance}/5)`);
          if (e.variable_relevance < QUALITY_THRESHOLDS.minVariableRelevance) problems.push(`doesn't match variable "${e.variable}"`);
          if (e.max_duplicate_similarity > QUALITY_THRESHOLDS.maxDuplicate) problems.push("too similar to another question");
          if (e.rule_violations.length) problems.push(`rule violations: ${e.rule_violations.join(", ")}`);
          if (e.llm_scores.clarity < QUALITY_THRESHOLDS.minLLM) problems.push(`low clarity (${e.llm_scores.clarity}/5)`);
          if (e.llm_scores.neutrality < QUALITY_THRESHOLDS.minLLM) problems.push(`possible bias (${e.llm_scores.neutrality}/5)`);
          if (e.response_option_issues?.length > 0) problems.push(`option issues: ${e.response_option_issues.join(", ")}`);
          if (e.skip_logic_issue) problems.push(e.skip_logic_issue.issue);
          if (e.response_scale_issue) problems.push(e.response_scale_issue.issue);
          return `- "${e.question}"\n  Problems: ${problems.join(", ")}`;
        })
        .join("\n");

      const res = await fetch("http://localhost:4000/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyDraft: {
            ...surveyDraft,
            feedback: `The following questions had quality issues and must be improved:\n${feedback}`
          },
          variableModel: variableModel.model
        })
      });

      const data = await res.json();

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestionsFromAI(data.questions);
        if (data.evaluations) setEvaluations(data.evaluations);
        navigate("/step/3-questions");
      }
    } catch (err) {
      console.error("Regeneration failed:", err);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRegenerateOne(evaluation) {
    setRegenerating(true);
    try {
      const problems = [];
      if (evaluation.llm_scores.relevance < QUALITY_THRESHOLDS.minLLM) problems.push(`low relevance (${evaluation.llm_scores.relevance}/5)`);
      if (evaluation.variable_relevance < QUALITY_THRESHOLDS.minVariableRelevance) problems.push(`doesn't match variable "${evaluation.variable}"`);
      if (evaluation.max_duplicate_similarity > QUALITY_THRESHOLDS.maxDuplicate) problems.push("too similar to another question");
      if (evaluation.rule_violations.length) problems.push(`rule violations: ${evaluation.rule_violations.join(", ")}`);
      if (evaluation.llm_scores.clarity < QUALITY_THRESHOLDS.minLLM) problems.push("low clarity");
      if (evaluation.llm_scores.neutrality < QUALITY_THRESHOLDS.minLLM) problems.push("possible bias");
      if (evaluation.response_option_issues?.length > 0) problems.push(`option issues: ${evaluation.response_option_issues.join(", ")}`);
      if (evaluation.skip_logic_issue) problems.push(evaluation.skip_logic_issue.issue);
      if (evaluation.response_scale_issue) problems.push(evaluation.response_scale_issue.issue);

      const res = await fetch("http://localhost:4000/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyDraft: {
            ...surveyDraft,
            feedback: `Regenerate ONLY this one question and keep all others the same:\n- "${evaluation.question}"\n  Assigned variable: "${evaluation.variable}"\n  Problems: ${problems.join(", ")}\n\nFix only this question, return the full question set.`
          },
          variableModel: variableModel.model
        })
      });

      const data = await res.json();

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestionsFromAI(data.questions);
        if (data.evaluations) setEvaluations(data.evaluations);
        navigate("/step/3-questions");
      }
    } catch (err) {
      console.error("Single question regeneration failed:", err);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="mono-block inline-block mb-2">[Quality Check (Bias + Validity)]</div>

      <div className="flex items-center gap-3 mb-2">
        <div className="text-2xl font-bold text-slate-900">{avgScore}/100</div>
        <div className={`text-xs px-2 py-1 rounded font-medium ${
          avgScore >= 80
            ? "bg-emerald-100 text-emerald-700"
            : avgScore >= 60
            ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700"
        }`}>
          {avgScore >= 80 ? "Good" : avgScore >= 60 ? "Needs Improvement" : "Poor"}
        </div>

        {hasIssues && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="ml-auto inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {regenerating ? "Regenerating…" : "⟳ Regenerate Poor Questions"}
          </button>
        )}

        {!hasIssues && (
          <span className="ml-auto text-xs text-emerald-600 font-medium">
            ✓ All questions passed quality check
          </span>
        )}
      </div>

      <div className="space-y-3">
        {evaluations.map((e, i) => {
          const issues = [];
          if (e.llm_scores.relevance < QUALITY_THRESHOLDS.minLLM) issues.push(`Low topic relevance (${e.llm_scores.relevance}/5)`);
          if (e.variable_relevance < QUALITY_THRESHOLDS.minVariableRelevance) issues.push(`Doesn't match variable "${e.variable}"`);
          if (e.max_duplicate_similarity > QUALITY_THRESHOLDS.maxDuplicate) issues.push("Too similar to another question");
          if (e.rule_violations.includes("multiple_questions")) issues.push("Contains multiple questions");
          if (e.rule_violations.includes("too_long")) issues.push("Question too long (>40 words)");
          if (e.rule_violations.includes("double_negative")) issues.push("Contains double negatives");
          if (e.rule_violations.includes("vague_language")) issues.push("Uses vague language");
          if (e.llm_scores.clarity < QUALITY_THRESHOLDS.minLLM) issues.push(`Low clarity (${e.llm_scores.clarity}/5)`);
          if (e.llm_scores.neutrality < QUALITY_THRESHOLDS.minLLM) issues.push(`Possible bias (${e.llm_scores.neutrality}/5)`);
          if (e.llm_scores.answerability < QUALITY_THRESHOLDS.minLLM) issues.push(`Hard to answer (${e.llm_scores.answerability}/5)`);
          if (e.response_option_issues?.length > 0) {
            e.response_option_issues.forEach(issue => {
              if (issue === "duplicate_options") issues.push("Duplicate response options");
              if (issue === "yes_no_mixed_with_other_choices") issues.push("Yes/No mixed with other options");
              if (issue === "only_one_option") issues.push("Only one response option");
              if (issue === "no_valid_options") issues.push("No valid response options");
            });
          }
          if (e.skip_logic_issue) issues.push(`Branch logic: ${e.skip_logic_issue.issue}`);
          if (e.response_scale_issue) issues.push(`Scale issue: ${e.response_scale_issue.issue}`);

          const isOk = issues.length === 0;

          return (
            <div
              key={i}
              className={`rounded-lg border p-3 text-sm ${
                isOk ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-medium text-slate-800 text-xs">{e.question}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    isOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {isOk ? "✓ OK" : `${issues.length} issue${issues.length > 1 ? "s" : ""}`}
                  </span>
                  {!isOk && (
                    <button
                      type="button"
                      disabled={regenerating}
                      onClick={() => handleRegenerateOne(e)}
                      className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                      title="Regenerate this question"
                    >
                      {regenerating ? "…" : "⟳"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-3 text-[10px] text-slate-500 mb-1 flex-wrap">
                <span>Relevance: {e.llm_scores.relevance}/5</span>
                <span>Var match: {(e.variable_relevance * 100).toFixed(0)}%</span>
                <span>Clarity: {e.llm_scores.clarity}/5</span>
                <span>Neutrality: {e.llm_scores.neutrality}/5</span>
                <span>Readability: {e.readability} ({readabilityLevel(e.readability)})</span>
              </div>

              {issues.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {issues.map((issue, j) => (
                    <li key={j} className="text-[11px] text-amber-700">
                      ⚠️ {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Step4Audit;