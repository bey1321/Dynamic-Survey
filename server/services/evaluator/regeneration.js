import { QUALITY_THRESHOLDS } from "../../../shared/constants.js";

export function needRegeneration(results, thresholds = {}, coverageIssues = []) {
  const T = { ...QUALITY_THRESHOLDS, ...thresholds };

  if (coverageIssues.length > 0) return true;

  let qualityFailCount = 0;

  for (const e of results) {
    const criticalRules = e.rule_violations.filter(v =>
      v === "multiple_questions" || v === "double_negative" || v === "double_barreled"
    );
    if (criticalRules.length > 0) return true;
    if (e.skip_logic_issue) return true;
    if (e.max_duplicate_similarity > 0.92) return true;

    const avgLLM = (e.llm_scores.clarity + e.llm_scores.neutrality + e.llm_scores.answerability + e.llm_scores.relevance) / 4;
    const minVarRelevance = e.variableRole === "control" ? T.minVariableRelevanceControl : T.minVariableRelevance;

    const hasQualityIssue =
      avgLLM < T.minLLMAverage ||
      e.llm_scores.clarity    < T.minLLMCritical ||
      e.llm_scores.neutrality < T.minLLMCritical ||
      e.variable_relevance    < minVarRelevance   ||
      (e.readability !== null && e.readability < T.minReadability) ||
      (e.response_option_issues?.length > 0) ||
      !!e.response_scale_issue;

    if (hasQualityIssue) qualityFailCount++;
  }

  return results.length > 0 && (qualityFailCount / results.length) > T.maxFailRatio;
}

export function buildRegenerationFeedback(results, topic, coverageIssues = []) {
  const bad = [];

  for (const e of results) {
    const p = [];
    const minVarRelevance = e.variableRole === "control" ? 0.2 : 0.3;

    if (e.llm_scores.relevance     < 3) p.push(`low relevance to topic (${e.llm_scores.relevance}/5)`);
    if (e.llm_scores.clarity       < 3) p.push(`low clarity (${e.llm_scores.clarity}/5)`);
    if (e.llm_scores.neutrality    < 3) p.push(`potential bias or leading language (${e.llm_scores.neutrality}/5)`);
    if (e.llm_scores.answerability < 3) p.push(`low answerability (${e.llm_scores.answerability}/5)`);
    if (e.variable_relevance < minVarRelevance) p.push(`question doesn't match its variable "${e.variable}" (similarity: ${e.variable_relevance})`);
    if (e.max_duplicate_similarity > 0.9) p.push("too similar to another question");
    if (e.rule_violations.length)  p.push(`rule violations: ${e.rule_violations.join(", ")}`);
    if (e.skip_logic_issue)        p.push(e.skip_logic_issue.issue || "invalid skip logic");
    if (e.response_scale_issue)    p.push(e.response_scale_issue.issue || "inconsistent response scale");

    if (p.length) bad.push({ q: e.question, p });
  }

  let text = `Survey topic: ${topic}\n\n`;

  if (coverageIssues.length > 0) {
    text += "Missing variable coverage — add questions for:\n";
    for (const c of coverageIssues) text += `- "${c.variable}"\n`;
    text += "\n";
  }

  if (bad.length > 0) {
    text += "The following questions need improvement:\n\n";
    for (const b of bad) text += `- ${b.q}\n  Problems: ${b.p.join(", ")}\n`;
    text += "\n";
  }

  text += "Regenerate improved questions that better match the topic and their assigned variables.";
  return text;
}
