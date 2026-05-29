import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSurvey } from "../state/SurveyContext";
import { QUALITY_THRESHOLDS } from "../../../shared/constants.js";

// Helper to interpret Flesch Reading Ease score
function readabilityLevel(score, t) {
  if (score >= 90) return t("survey:veryEasy");
  if (score >= 80) return t("survey:easy");
  if (score >= 70) return t("survey:fairlyEasy");
  if (score >= 60) return t("survey:standard");
  if (score >= 50) return t("survey:fairlyDifficult");
  if (score >= 30) return t("survey:difficult");
  return t("survey:veryDifficult");
}

function Step4Audit() {
  const { t } = useTranslation(["common", "survey"]);
  const {
    evaluations,
    hasEvaluationIssues,
    setEvaluations,
    surveyDraft,
    variableModel,
    setQuestionsFromAI,
  } = useSurvey();
  const navigate = useNavigate();
  const [regenerating, setRegenerating] = useState(false);

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mono-block inline-block mb-2">
          [{t("survey:qualityCheckTitle")}]
        </div>
        <div className="text-sm text-slate-400 py-6">
          {t("survey:noQualityCheckResults")}
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
        .filter(
          (e) =>
            e.llm_scores.relevance < QUALITY_THRESHOLDS.minLLM ||
            e.llm_scores.clarity < QUALITY_THRESHOLDS.minLLM ||
            e.llm_scores.neutrality < QUALITY_THRESHOLDS.minLLM ||
            e.variable_relevance < QUALITY_THRESHOLDS.minVariableRelevance ||
            e.max_duplicate_similarity > QUALITY_THRESHOLDS.maxDuplicate ||
            e.rule_violations.length > 0 ||
            (e.response_option_issues?.length ?? 0) > 0 ||
            e.skip_logic_issue ||
            e.response_scale_issue,
        )
        .map((e) => {
          const problems = [];
          if (e.llm_scores.relevance < QUALITY_THRESHOLDS.minLLM)
            problems.push(`${t("survey:lowRelevance")} (${e.llm_scores.relevance}/5)`);
          if (e.variable_relevance < QUALITY_THRESHOLDS.minVariableRelevance)
            problems.push(`${t("survey:doesntMatchVariable")} "${e.variable}"`);
          if (e.max_duplicate_similarity > QUALITY_THRESHOLDS.maxDuplicate)
            problems.push(t("survey:tooSimilarToAnotherQuestion"));
          if (e.rule_violations.length)
            problems.push(
              `${t("survey:ruleViolations")}: ${e.rule_violations.join(", ")}`,
            );
          if (e.llm_scores.clarity < QUALITY_THRESHOLDS.minLLM)
            problems.push(`${t("survey:lowClarity")} (${e.llm_scores.clarity}/5)`);
          if (e.llm_scores.neutrality < QUALITY_THRESHOLDS.minLLM)
            problems.push(`${t("survey:possibleBias")} (${e.llm_scores.neutrality}/5)`);
          if (e.response_option_issues?.length > 0)
            problems.push(
              `${t("survey:optionIssues")}: ${e.response_option_issues.join(", ")}`,
            );
          if (e.skip_logic_issue) problems.push(e.skip_logic_issue.issue);
          if (e.response_scale_issue) problems.push(e.response_scale_issue.issue);
          return `- "${e.question}"\n  ${t("survey:problems")}: ${problems.join(", ")}`;
        })
        .join("\n");

      const res = await fetch("http://localhost:4000/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyDraft: {
            ...surveyDraft,
            feedback: `${t("survey:qualityIssuesFeedbackIntro")}\n${feedback}`,
          },
          variableModel: variableModel.model,
        }),
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
      if (evaluation.llm_scores.relevance < QUALITY_THRESHOLDS.minLLM)
        problems.push(`${t("survey:lowRelevance")} (${evaluation.llm_scores.relevance}/5)`);
      if (evaluation.variable_relevance < QUALITY_THRESHOLDS.minVariableRelevance)
        problems.push(`${t("survey:doesntMatchVariable")} "${evaluation.variable}"`);
      if (evaluation.max_duplicate_similarity > QUALITY_THRESHOLDS.maxDuplicate)
        problems.push(t("survey:tooSimilarToAnotherQuestion"));
      if (evaluation.rule_violations.length)
        problems.push(
          `${t("survey:ruleViolations")}: ${evaluation.rule_violations.join(", ")}`,
        );
      if (evaluation.llm_scores.clarity < QUALITY_THRESHOLDS.minLLM)
        problems.push(t("survey:lowClarity"));
      if (evaluation.llm_scores.neutrality < QUALITY_THRESHOLDS.minLLM)
        problems.push(t("survey:possibleBias"));
      if (evaluation.response_option_issues?.length > 0)
        problems.push(
          `${t("survey:optionIssues")}: ${evaluation.response_option_issues.join(", ")}`,
        );
      if (evaluation.skip_logic_issue) problems.push(evaluation.skip_logic_issue.issue);
      if (evaluation.response_scale_issue) problems.push(evaluation.response_scale_issue.issue);

      const res = await fetch("http://localhost:4000/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyDraft: {
            ...surveyDraft,
            feedback: `${t("survey:regenerateOnlyThisQuestion")}\n- "${evaluation.question}"\n  ${t("survey:assignedVariable")}: "${evaluation.variable}"\n  ${t("survey:problems")}: ${problems.join(", ")}\n\n${t("survey:fixOnlyThisQuestion")}`,
          },
          variableModel: variableModel.model,
        }),
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
      <div className="mono-block inline-block mb-2">
        [{t("survey:qualityCheckTitle")}]
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="text-2xl font-bold text-slate-900">{avgScore}/100</div>
        <div
          className={`text-xs px-2 py-1 rounded font-medium ${
            avgScore >= 80
              ? "bg-emerald-100 text-emerald-700"
              : avgScore >= 60
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {avgScore >= 80
            ? t("survey:good")
            : avgScore >= 60
              ? t("survey:needsImprovement")
              : t("survey:poor")}
        </div>

        {hasIssues && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="ml-auto inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {regenerating
              ? t("survey:regenerating")
              : t("survey:regeneratePoorQuestions")}
          </button>
        )}

        {!hasIssues && (
          <span className="ml-auto text-xs text-emerald-600 font-medium">
            ✓ {t("survey:allQuestionsPassed")}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {evaluations.map((e, i) => {
          const issues = [];
          if (e.llm_scores.relevance < QUALITY_THRESHOLDS.minLLM)
            issues.push(`${t("survey:lowTopicRelevance")} (${e.llm_scores.relevance}/5)`);
          if (e.variable_relevance < QUALITY_THRESHOLDS.minVariableRelevance)
            issues.push(`${t("survey:doesntMatchVariable")} "${e.variable}"`);
          if (e.max_duplicate_similarity > QUALITY_THRESHOLDS.maxDuplicate)
            issues.push(t("survey:tooSimilarToAnotherQuestion"));
          if (e.rule_violations.includes("multiple_questions"))
            issues.push(t("survey:containsMultipleQuestions"));
          if (e.rule_violations.includes("too_long"))
            issues.push(t("survey:questionTooLong"));
          if (e.rule_violations.includes("double_negative"))
            issues.push(t("survey:containsDoubleNegatives"));
          if (e.rule_violations.includes("vague_language"))
            issues.push(t("survey:usesVagueLanguage"));
          if (e.llm_scores.clarity < QUALITY_THRESHOLDS.minLLM)
            issues.push(`${t("survey:lowClarity")} (${e.llm_scores.clarity}/5)`);
          if (e.llm_scores.neutrality < QUALITY_THRESHOLDS.minLLM)
            issues.push(`${t("survey:possibleBias")} (${e.llm_scores.neutrality}/5)`);
          if (e.llm_scores.answerability < QUALITY_THRESHOLDS.minLLM)
            issues.push(`${t("survey:hardToAnswer")} (${e.llm_scores.answerability}/5)`);
          if (e.response_option_issues?.length > 0) {
            e.response_option_issues.forEach((issue) => {
              if (issue === "duplicate_options")
                issues.push(t("survey:duplicateResponseOptions"));
              if (issue === "yes_no_mixed_with_other_choices")
                issues.push(t("survey:yesNoMixedWithOtherOptions"));
              if (issue === "only_one_option")
                issues.push(t("survey:onlyOneResponseOption"));
              if (issue === "no_valid_options")
                issues.push(t("survey:noValidResponseOptions"));
            });
          }
          if (e.skip_logic_issue)
            issues.push(`${t("survey:branchLogic")}: ${e.skip_logic_issue.issue}`);
          if (e.response_scale_issue)
            issues.push(`${t("survey:scaleIssue")}: ${e.response_scale_issue.issue}`);

          const isOk = issues.length === 0;

          return (
            <div
              key={i}
              className={`rounded-lg border p-3 text-sm ${
                isOk
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-medium text-slate-800 text-xs">{e.question}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      isOk
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isOk
                      ? `✓ ${t("survey:ok")}`
                      : `${issues.length} ${issues.length > 1 ? t("survey:issuesPlural") : t("survey:issueSingular")}`}
                  </span>
                  {!isOk && (
                    <button
                      type="button"
                      disabled={regenerating}
                      onClick={() => handleRegenerateOne(e)}
                      className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                      title={t("survey:regenerateThisQuestion")}
                    >
                      {regenerating ? t("survey:loadingDots") : "⟳"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-3 text-[10px] text-slate-500 mb-1 flex-wrap">
                <span>{t("survey:relevance")}: {e.llm_scores.relevance}/5</span>
                <span>{t("survey:varMatch")}: {(e.variable_relevance * 100).toFixed(0)}%</span>
                <span>{t("survey:clarity")}: {e.llm_scores.clarity}/5</span>
                <span>{t("survey:neutrality")}: {e.llm_scores.neutrality}/5</span>
                <span>
                  {t("survey:readability")}: {e.readability} ({readabilityLevel(e.readability, t)})
                </span>
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