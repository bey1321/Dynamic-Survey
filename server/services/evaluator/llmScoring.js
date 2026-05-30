const DEFAULT_SCORES = { clarity: 4, neutrality: 4, answerability: 4, relevance: 4 };

function clampScore(value) {
  return typeof value === "number" && value >= 1 && value <= 5 ? value : 4;
}

export async function llmQualityScoreBatch(questions, topic, geminiCallFn) {
  if (!geminiCallFn) {
    return questions.map(() => ({ ...DEFAULT_SCORES }));
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
    const result = await geminiCallFn(userPrompt, systemPrompt, null, false, "LLM Quality Scoring (Batch)");

    if (Array.isArray(result) && result.length === questions.length) {
      return result.map(r => ({
        clarity:       clampScore(r.clarity),
        neutrality:    clampScore(r.neutrality),
        answerability: clampScore(r.answerability),
        relevance:     clampScore(r.relevance),
      }));
    }

    console.warn(`Expected ${questions.length} LLM scores, got ${Array.isArray(result) ? result.length : 0}. Using defaults.`);
    return questions.map(() => ({ ...DEFAULT_SCORES }));
  } catch (err) {
    console.error("Batch LLM scoring failed:", err);
    return questions.map(() => ({ ...DEFAULT_SCORES }));
  }
}
