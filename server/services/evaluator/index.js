import { variableRelevanceScore } from "./variableRelevance.js";
import { readabilityScore } from "./readability.js";
import { duplicateScores } from "./duplicates.js";
import { ruleViolations } from "./ruleViolations.js";
import { llmQualityScoreBatch } from "./llmScoring.js";
import { checkVariableCoverage, validateSkipLogic, checkResponseScaleConsistency, validateResponseOptions } from "./surveyChecks.js";

export { validateResponseOptions } from "./surveyChecks.js";
export { needRegeneration, buildRegenerationFeedback } from "./regeneration.js";

export async function evaluateQuestions(topic, questions, geminiCallFn = null, variableModel = null, language = "English") {
  const isArabic = language === "Arabic";
  const questionTexts = questions.map(q => (typeof q === "string" ? q : q.text));

  const skipIssues     = validateSkipLogic(questions);
  const scaleIssues    = checkResponseScaleConsistency(questions);
  const coverageIssues = checkVariableCoverage(questions, variableModel);

  const dup         = await duplicateScores(questionTexts);
  const batchScores = await llmQualityScoreBatch(questions, topic, geminiCallFn);

  const results = [];

  for (let i = 0; i < questionTexts.length; i++) {
    const qText     = questionTexts[i];
    const qOriginal = questions[i];
    const variableName = typeof qOriginal === "object" ? qOriginal.variable     : null;
    const variableRole = typeof qOriginal === "object" ? qOriginal.variableRole : null;

    const varRelevance = isArabic ? 1.0 : await variableRelevanceScore(qText, variableName, variableRole);
    const read         = isArabic ? null : readabilityScore(qText);
    const rules        = isArabic ? []   : ruleViolations(qText);

    let optionIssues = [];
    if (typeof qOriginal === "object" && Array.isArray(qOriginal.options)) {
      optionIssues = validateResponseOptions(qOriginal.options);
    }

    const llm = batchScores[i];

    let maxDup = 0;
    for (let j = 0; j < questionTexts.length; j++) {
      if (i !== j) maxDup = Math.max(maxDup, dup[i][j]);
    }

    results.push({
      question:                 qText,
      originalQuestion:         qOriginal,
      variable:                 variableName,
      variableRole:             variableRole,
      variable_relevance:       parseFloat(varRelevance.toFixed(4)),
      relevance:                llm.relevance / 5,
      readability:              read,
      max_duplicate_similarity: parseFloat(maxDup.toFixed(4)),
      rule_violations:          rules,
      llm_scores:               llm,
      response_option_issues:   optionIssues,
      skip_logic_issue:         skipIssues.find(s => s.question === qText) || null,
      response_scale_issue:     scaleIssues.find(s => s.question === qText) || null,
    });
  }

  return { results, coverageIssues };
}
