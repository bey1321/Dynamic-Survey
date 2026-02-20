
import { pipeline } from "@xenova/transformers";
import { QUALITY_THRESHOLDS } from "../shared/constants.js";

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    try {
      embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    } catch (err) {
      console.error("Failed to load embedder model:", err);
      return null;
    }
  }
  return embedder;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function buildVariablePrompt(variableName, variableRole) {
  if (variableRole === "control") {
    return `This is a demographic or background question collecting information about: ${variableName}.`;
  }
  if (variableRole === "driver") {
    return `This question measures a factor that influences the outcome: ${variableName}.`;
  }
  if (variableRole === "dependent") {
    return `This question measures the primary outcome variable: ${variableName}.`;
  }
  return `This question measures the variable: ${variableName}.`;
}

async function variableRelevanceScore(questionText, assignedVariable, variableRole) {
  if (!assignedVariable) return 1.0;

  const model = await getEmbedder();
  if (!model) return 1.0;

  try {
    const qOut = await model(questionText, { pooling: "mean", normalize: true });
    const qEmb = Array.from(qOut.data);

    const prompt = buildVariablePrompt(assignedVariable, variableRole);
    const vOut = await model(prompt, { pooling: "mean", normalize: true });
    const vEmb = Array.from(vOut.data);

    return parseFloat(cosineSimilarity(qEmb, vEmb).toFixed(4));
  } catch {
    return 1.0;
  }
}


function countSyllables(word) {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function fleschReadingEase(text) {
  const sentences = Math.max(1, text.split(/[.!?]/).filter(Boolean).length);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const syllables = words.reduce((s, w) => s + countSyllables(w), 0);

  const W = words.length || 1;
  const S = sentences;
  const SY = syllables;

  return 206.835 - 1.015 * (W / S) - 84.6 * (SY / W);
}

function readabilityScore(questionText) {
  const score = fleschReadingEase(questionText);
  return parseFloat(Math.min(100, Math.max(0, score)).toFixed(2));
}


async function duplicateScores(questionTexts) {
  const model = await getEmbedder();

  if (!model) {
    return questionTexts.map((_, i) =>
      questionTexts.map((_, j) => (i === j ? 1 : 0))
    );
  }

  try {
    const embs = [];
    for (const q of questionTexts) {
      const out = await model(q, { pooling: "mean", normalize: true });
      embs.push(Array.from(out.data));
    }

    const matrix = [];
    for (let i = 0; i < embs.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < embs.length; j++) {
        matrix[i][j] = cosineSimilarity(embs[i], embs[j]);
      }
    }
    return matrix;
  } catch (err) {
    return questionTexts.map((_, i) =>
      questionTexts.map((_, j) => (i === j ? 1 : 0))
    );
  }
}

function ruleViolations(questionText) {
  const v = [];
  const text = questionText.toLowerCase();
  const words = text.split(/\s+/);

  
  const questionMarks = (questionText.match(/\?/g) || []).length;
  if (questionMarks > 1)
    v.push("multiple_questions");

    if (questionText.split(/\s+/).length > 40)
      v.push("too_long");

  const negWords = new Set(["not", "never", "no", "none", "hardly", "rarely", "neither", "nor"]);
  for (let i = 0; i < words.length; i++) {
    if (negWords.has(words[i])) {
      for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
        const clean = words[j].replace(/[^a-z]/g, "");
        if (negWords.has(clean)) {
          v.push("double_negative");
          break;
        }
      }
    }
    if (v.includes("double_negative")) break;
  }

  // vague words
  const vague = ["often", "usually", "sometimes", "many", "some", "a lot", "regularly"];
  if (vague.some(w => text.includes(w)))
    v.push("vague_language");

  // leading/loaded language
  const leadingPhrases = [
    "would you agree",
    "would you say",
    "don't you think",
    "surely",
    "obviously",
    "naturally",
    "it's clear that",
    "as everyone knows",
    "most people",
    "everyone agrees"
  ];
  if (leadingPhrases.some(phrase => text.includes(phrase)))
    v.push("leading_language");

  return v;
}

async function llmQualityScoreBatch(questions, topic, geminiCallFn) {
  if (!geminiCallFn) {
    return questions.map(() => ({ clarity: 4, neutrality: 4, answerability: 4, relevance: 4 }));
  }

  const systemPrompt = `You are a survey quality evaluator. You will receive a list of survey questions and must score each one on four criteria from 1-5. Return ONLY a valid JSON array in the same order as the input, like:
[{"clarity": 4, "neutrality": 3, "answerability": 5, "relevance": 4}, ...]`;

  const questionsText = questions.map((q, i) => {
    const text = typeof q === "string" ? q : q.text;
    const variable = typeof q === "object" ? q.variable : null;
    const role = typeof q === "object" ? q.variableRole : null;
    return `${i + 1}. Question: "${text}"\n   Variable: "${variable || "unknown"}" (${role || "unknown"})`;
  }).join("\n");

  const userPrompt = `Survey topic: "${topic}"

Questions to evaluate:
${questionsText}

Score each question on:
- clarity (1-5): Is it easy to understand?
- neutrality (1-5): Is it free from bias or leading language?
- answerability (1-5): Can respondents reasonably answer this?
- relevance (1-5): Does it appropriately measure its assigned variable? Note: demographic/control questions are always relevant.

Return a JSON array with ${questions.length} objects, one per question, in the same order.`;

  try {
    const result = await geminiCallFn(userPrompt, systemPrompt, null);

    if (Array.isArray(result) && result.length === questions.length) {
      return result.map(r => ({
        clarity: typeof r.clarity === "number" && r.clarity >= 1 && r.clarity <= 5 ? r.clarity : 4,
        neutrality: typeof r.neutrality === "number" && r.neutrality >= 1 && r.neutrality <= 5 ? r.neutrality : 4,
        answerability: typeof r.answerability === "number" && r.answerability >= 1 && r.answerability <= 5 ? r.answerability : 4,
        relevance: typeof r.relevance === "number" && r.relevance >= 1 && r.relevance <= 5 ? r.relevance : 4
      }));
    }

    console.warn(`Expected ${questions.length} LLM scores, got ${Array.isArray(result) ? result.length : 0}. Using defaults.`);
    return questions.map(() => ({ clarity: 4, neutrality: 4, answerability: 4, relevance: 4 }));

  } catch (err) {
    console.error("Batch LLM scoring failed:", err);
    return questions.map(() => ({ clarity: 4, neutrality: 4, answerability: 4, relevance: 4 }));
  }
}

export async function evaluateQuestions(topic, questions, geminiCallFn = null) {
  const questionTexts = questions.map((q) => (typeof q === "string" ? q : q.text));
  const skipIssues = validateSkipLogic(questions);
  const scaleIssues = checkResponseScaleConsistency(questions);
  

  const results = [];
  const dup = await duplicateScores(questionTexts);

  const batchScores = await llmQualityScoreBatch(questions, topic, geminiCallFn);

  for (let i = 0; i < questionTexts.length; i++) {
    const qText = questionTexts[i];
    const qOriginal = questions[i];
    const variableName = typeof qOriginal === "object" ? qOriginal.variable : null;
    const variableRole = typeof qOriginal === "object" ? qOriginal.variableRole : null;

    const varRelevance = await variableRelevanceScore(qText, variableName, variableRole);
    const read = readabilityScore(qText);
    const rules = ruleViolations(qText);
    let optionIssues = [];

    if (typeof qOriginal === "object" && Array.isArray(qOriginal.options)) {
      optionIssues = validateResponseOptions(qOriginal.options);
    }

    const llm = batchScores[i]; // ← use pre-fetched score

    let maxDup = 0;
    for (let j = 0; j < questionTexts.length; j++) {
      if (i !== j) maxDup = Math.max(maxDup, dup[i][j]);
    }

    results.push({
      question: qText,
      originalQuestion: qOriginal,
      variable: variableName,
      variableRole: variableRole,
      variable_relevance: parseFloat(varRelevance.toFixed(4)),
      relevance: llm.relevance / 5,
      readability: read,
      max_duplicate_similarity: parseFloat(maxDup.toFixed(4)),
      rule_violations: rules,
      llm_scores: llm,
      response_option_issues: optionIssues,
      skip_logic_issue: skipIssues.find(s => s.question === qText) || null,
      response_scale_issue: scaleIssues.find(s => s.question === qText) || null
    });
  }

  return results;
}

function validateSkipLogic(questions) {
  const issues = [];
  const questionIds = new Set(questions.map(q => q.id));
  
  for (const q of questions) {
    if (q.branchFrom) {
      // Check if parent question exists
      if (!questionIds.has(q.branchFrom)) {
        issues.push({
          question: q.text,
          issue: `Branch references non-existent question: ${q.branchFrom}`
        });
      }
      // Check if branch condition is valid
      if (!q.branchCondition || !q.branchCondition.operator) {
        issues.push({
          question: q.text,
          issue: "Branch condition missing or invalid"
        });
      }
    }
  }
  
  return issues;
}

function checkResponseScaleConsistency(questions) {
  const issues = [];

  // Collect all likert scales used
  const likertScales = questions
    .filter(q => q.type === "likert" && Array.isArray(q.options))
    .map(q => q.options.length);

  // Find the most common likert scale size
  const dominantLikert = likertScales.length > 0
    ? likertScales.sort((a, b) =>
        likertScales.filter(v => v === b).length - likertScales.filter(v => v === a).length
      )[0]
    : null;

  // Flag any likert question that deviates from dominant scale
  if (dominantLikert) {
    questions
      .filter(q => q.type === "likert" && Array.isArray(q.options))
      .forEach(q => {
        if (q.options.length !== dominantLikert) {
          issues.push({
            question: q.text,
            issue: `Inconsistent Likert scale: uses ${q.options.length}-point scale but survey mostly uses ${dominantLikert}-point`
          });
        }
      });
  }

  // Collect all rating scales used
  const ratingScales = questions
    .filter(q => q.type === "rating" && Array.isArray(q.options))
    .map(q => q.options.length);

  const dominantRating = ratingScales.length > 0
    ? ratingScales.sort((a, b) =>
        ratingScales.filter(v => v === b).length - ratingScales.filter(v => v === a).length
      )[0]
    : null;

  if (dominantRating) {
    questions
      .filter(q => q.type === "rating" && Array.isArray(q.options))
      .forEach(q => {
        if (q.options.length !== dominantRating) {
          issues.push({
            question: q.text,
            issue: `Inconsistent rating scale: uses ${q.options.length}-point scale but survey mostly uses ${dominantRating}-point`
          });
        }
      });
  }

  return issues;
}

export function validateResponseOptions(options = []) {
  const problems = [];

  if (!Array.isArray(options) || options.length === 0)
    return problems;

  // Filter out empty strings
  const validOptions = options.filter(o => String(o).trim().length > 0);
  if (validOptions.length === 0) {
    problems.push("no_valid_options");
    return problems;
  }

  const normalized = validOptions.map(o =>
    String(o).trim().toLowerCase()
  );

  // Check for duplicates
  const set = new Set(normalized);
  if (set.size !== normalized.length) {
    problems.push("duplicate_options");
  }

  // Check for yes/no option purity (shouldn't mix with other choices)
  const hasYes = normalized.includes("yes");
  const hasNo = normalized.includes("no");
  if (
    (hasYes || hasNo) &&
    normalized.length > 2
  ) {
    problems.push("yes_no_mixed_with_other_choices");
  }

  // Warn if only 1 option (not really a choice)
  if (validOptions.length === 1) {
    problems.push("only_one_option");
  }

  return problems;
}

export function needRegeneration(evals, thresholds = {}) {
  const T = { ...QUALITY_THRESHOLDS, ...thresholds };

  for (const e of evals) {
    if (e.llm_scores.relevance < T.minLLM) return true;
    if (e.llm_scores.clarity < T.minLLM) return true;
    if (e.llm_scores.neutrality < T.minLLM) return true;
    if (e.llm_scores.answerability < T.minLLM) return true;

    // role-aware variable relevance threshold
    const minRelevance = e.variableRole === "control" ? T.minVariableRelevanceControl : T.minVariableRelevance;
    if (e.variable_relevance < minRelevance) return true;

    if (e.max_duplicate_similarity > T.maxDuplicate) return true;
    if (e.rule_violations.length > 0) return true;
    if (e.response_option_issues?.length > 0) return true;
    if (e.skip_logic_issue) return true;
    if (e.response_scale_issue) return true;
  }

  return false;
}

export function buildRegenerationFeedback(evals, topic) {
  const bad = [];

  for (const e of evals) {
    const p = [];
    if (e.llm_scores.relevance < 3) p.push(`low relevance to topic (${e.llm_scores.relevance}/5)`);
    if (e.llm_scores.clarity < 3) p.push(`low clarity (${e.llm_scores.clarity}/5)`);
    if (e.llm_scores.neutrality < 3) p.push(`potential bias or leading language (${e.llm_scores.neutrality}/5)`);
    if (e.llm_scores.answerability < 3) p.push(`low answerability (${e.llm_scores.answerability}/5)`);
    if (e.variable_relevance < (e.variableRole === "control" ? 0.2 : 0.3)) p.push(`question doesn't match its variable "${e.variable}" (similarity: ${e.variable_relevance})`);
    if (e.max_duplicate_similarity > 0.9) p.push("too similar to another question");
    if (e.rule_violations.length) p.push(`rule violations: ${e.rule_violations.join(", ")}`);
    if (e.skip_logic_issue) p.push(e.skip_logic_issue.issue || "invalid skip logic");
    if (e.response_scale_issue) p.push(e.response_scale_issue.issue || "inconsistent response scale");
    if (e.llm_scores.answerability < 3 || e.llm_scores.clarity < 3)   // ← add here
      p.push(`possible double-barreled question — split into separate questions, each measuring one thing only`);
    if (p.length) bad.push({ q: e.question, p });   // ← before this line
  }

  let text = `Survey topic: ${topic}\n\n`;
  text += "The following questions need improvement:\n\n";
  for (const b of bad) {
    text += `- ${b.q}\n  Problems: ${b.p.join(", ")}\n`;
  }
  text += "\nRegenerate improved questions that better match the topic and their assigned variables.";
  return text;
}
