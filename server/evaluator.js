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

async function variableRelevanceScore(questionText, allVariables) {
  if (!allVariables || allVariables.length === 0) return 1.0;
  const model = await getEmbedder();
  if (!model) return 1.0;

  try {
    const qOut = await model(questionText, { pooling: "mean", normalize: true });
    const qEmb = Array.from(qOut.data);

    let maxScore = 0;
    for (const variable of allVariables) {
      if (!variable) continue;
      const variablePrompt =
      `This question measures the variable: ${variable}.`;

    const vOut = await model(variablePrompt, {
      pooling: "mean",
      normalize: true
    });

    const vEmb = Array.from(vOut.data);
    const score = cosineSimilarity(qEmb, vEmb);
    if (score > maxScore) maxScore = score;
    }

    return maxScore;
  } catch (err) {
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
  return parseFloat(fleschReadingEase(questionText).toFixed(2));
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

  if (questionText.slice(0, -1).includes("?"))
    v.push("multiple_questions");

  if (questionText.split(/\s+/).length > 40)
    v.push("too_long");

  // double negatives
  const neg = ["not", "never", "no", "none", "hardly", "rarely"];
  let negCount = 0;
  for (const n of neg) {
    const m = text.match(new RegExp(`\\b${n}\\b`, "g"));
    if (m) negCount += m.length;
  }
  if (negCount >= 2)
    v.push("double_negative");

  // vague words
  const vague = [
    "often", "usually", "sometimes", "many", "some", "a lot", "regularly"
  ];
  if (vague.some(w => text.includes(w)))
    v.push("vague_language");

  return v;
}

async function llmQualityScore(questionText, topic, variableName, variableRole, geminiCallFn) {
  if (!geminiCallFn) {
    return { clarity: 4, neutrality: 4, answerability: 4, relevance: 4 };
  }

  try {
    const systemPrompt = `You are a survey quality evaluator. Score the given question on four criteria from 1-5. Return ONLY valid JSON like: {"clarity": 4, "neutrality": 3, "answerability": 5, "relevance": 4}`;

    const userPrompt = `Survey topic: "${topic}"
      Question: "${questionText}"
      Assigned variable: "${variableName || "unknown"}"
      Variable role: "${variableRole || "unknown"}" (dependent = outcome being measured, driver = factor influencing outcome, control = demographic/background)

      Score this question on:
      - clarity (1-5): Is the question easy to understand?
      - neutrality (1-5): Is it free from bias or leading language?
      - answerability (1-5): Can respondents reasonably answer this?
      - relevance (1-5): Does this question appropriately measure its assigned variable for this survey topic? Note: control/demographic questions like age, gender, location are always relevant even if not directly about the topic.`;

    const result = await geminiCallFn(userPrompt, systemPrompt, {
      clarity: 4,
      neutrality: 4,
      answerability: 4,
      relevance: 4
    });

    return {
      clarity: typeof result.clarity === "number" ? result.clarity : 4,
      neutrality: typeof result.neutrality === "number" ? result.neutrality : 4,
      answerability: typeof result.answerability === "number" ? result.answerability : 4,
      relevance: typeof result.relevance === "number" ? result.relevance : 4
    };
  } catch (err) {
    return { clarity: 4, neutrality: 4, answerability: 4, relevance: 4 };
  }
}

export async function evaluateQuestions(topic, questions, geminiCallFn = null) {
  const questionTexts = questions.map((q) => (typeof q === "string" ? q : q.text));
  const skipIssues = validateSkipLogic(questions);
  const scaleIssues = checkResponseScaleConsistency(questions);
  // Collect all unique variable names across all questions
  const allVariables = [
    ...new Set(
      questions
        .map((q) => (typeof q === "object" ? q.variable : null))
        .filter(Boolean)
    )
  ];

  const results = [];
  const dup = await duplicateScores(questionTexts);

  for (let i = 0; i < questionTexts.length; i++) {
    const qText = questionTexts[i];
    const qOriginal = questions[i];
    const variableName = typeof qOriginal === "object" ? qOriginal.variable : null;
    const variableRole = typeof qOriginal === "object" ? qOriginal.variableRole : null;

    const varRelevance = await variableRelevanceScore(qText, allVariables);
    const read = readabilityScore(qText);
    const rules = ruleViolations(qText);
    let optionIssues = [];

    if (
      typeof qOriginal === "object" &&
      Array.isArray(qOriginal.options)
    ) {
      optionIssues = validateResponseOptions(qOriginal.options);
    }

    const llm = await llmQualityScore(qText, topic, variableName, variableRole, geminiCallFn);

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
  // Note: Cannot reliably check response scale consistency without semantic understanding.
  // Scales can be numeric, text, or mixed. Deferred to LLM evaluation.
  return [];
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

  const T = {
    ...QUALITY_THRESHOLDS,
    ...thresholds
  };

  for (const e of evals) {

    if (e.llm_scores.relevance < T.minLLM) return true;
    if (e.llm_scores.clarity < T.minLLM) return true;
    if (e.llm_scores.answerability < T.minLLM) return true;

    if (e.variable_relevance < T.minVariableRelevance) return true;
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
    if (e.variable_relevance < 0.3) p.push(`question doesn't match its variable "${e.variable}"`);
    if (e.max_duplicate_similarity > 0.9) p.push("too similar to another question");
    if (e.rule_violations.length) p.push(`rule violations: ${e.rule_violations.join(", ")}`);
    if (e.llm_scores.clarity < 3) p.push("low clarity");
    if (e.llm_scores.answerability < 3) p.push("low answerability");
    if (e.skip_logic_issue) p.push("invalid skip logic");
    if (e.response_scale_issue) p.push("inconsistent response scale");
    if (p.length) bad.push({ q: e.question, p });
  }

  let text = `Survey topic: ${topic}\n\n`;
  text += "The following questions need improvement:\n\n";
  for (const b of bad) {
    text += `- ${b.q}\n  Problems: ${b.p.join(", ")}\n`;
  }
  text += "\nRegenerate improved questions that better match the topic and their assigned variables.";
  return text;
}