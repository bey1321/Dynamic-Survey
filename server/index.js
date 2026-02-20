import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  VARIABLE_MODEL_SYSTEM_PROMPT,
  buildVariableModelUserPrompt,
  SURVEY_CONFIG_SYSTEM_PROMPT,
  buildSurveyConfigUserPrompt,
  QUESTION_GEN_SYSTEM_PROMPT,
  buildQuestionGenUserPrompt
} from "../shared/promptTemplates.js";
import { FALLBACK_VARIABLE_MODEL, HEALTHCARE_EXAMPLE_SURVEY, FALLBACK_QUESTIONS } from "../shared/demoData.js";
import {
  evaluateQuestions,
  needRegeneration,
  buildRegenerationFeedback
} from "./evaluator.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

// ── OpenRouter ──────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.GEMMA_MODEL || "google/gemma-3-27b-it:free";

console.log("Using model:", OPENROUTER_MODEL);
console.log("OpenRouter key loaded:", OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.slice(0, 10)}…` : "MISSING");

async function callOpenRouter(inputPrompt, systemPrompt, fallbackValue, isRetry = false) {
  if (!OPENROUTER_API_KEY) {
    console.error("OpenRouter API key is missing!");
    return fallbackValue;
  }

  const userContent = isRetry
    ? `${inputPrompt}\n\nReturn ONLY valid JSON.`
    : inputPrompt;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Dynamic Survey Generator"
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ]
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("OpenRouter API error:", res.status, errorText);
      return fallbackValue;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";

    if (!text) {
      console.error("Empty response from OpenRouter");
      return fallbackValue;
    }

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("JSON parse error:", err.message);
      if (!isRetry) {
        return await callOpenRouter(inputPrompt, systemPrompt, fallbackValue, true);
      }
      return fallbackValue;
    }
  } catch (err) {
    console.error("Fetch error:", err);
    return fallbackValue;
  }
}
// ───────────────────────────────────────────────────────────────────

async function callGeminiForVariableModel(input) {
  const userPrompt = buildVariableModelUserPrompt(input);
  const parsed = await callOpenRouter(userPrompt, VARIABLE_MODEL_SYSTEM_PROMPT, FALLBACK_VARIABLE_MODEL);

  if (!Array.isArray(parsed.dependent) || !Array.isArray(parsed.drivers) || !Array.isArray(parsed.controls)) {
    return FALLBACK_VARIABLE_MODEL;
  }

  return parsed;
}

async function callGeminiForSurveyConfig(text) {
  const userPrompt = buildSurveyConfigUserPrompt(text);
  const parsed = await callOpenRouter(userPrompt, SURVEY_CONFIG_SYSTEM_PROMPT, HEALTHCARE_EXAMPLE_SURVEY);

  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    goal: typeof parsed.goal === "string" ? parsed.goal : "",
    population: typeof parsed.population === "string" ? parsed.population : "",
    confidence: typeof parsed.confidence === "string" ? parsed.confidence : "",
    margin: typeof parsed.margin === "string" ? parsed.margin : "",
    language: Array.isArray(parsed.language) ? parsed.language : [],
    tone: typeof parsed.tone === "string" ? parsed.tone : "",
    maxQuestions:
      typeof parsed.maxQuestions === "number" && Number.isFinite(parsed.maxQuestions)
        ? parsed.maxQuestions
        : 10
  };
}

const VALID_QUESTION_TYPES = new Set(["likert", "multiple_choice", "multi_select", "yes_no", "open_ended", "rating"]);

async function callGeminiForQuestions(surveyDraft, variableModel) {
  const userPrompt = buildQuestionGenUserPrompt(surveyDraft, variableModel);
  const parsed = await callOpenRouter(userPrompt, QUESTION_GEN_SYSTEM_PROMPT, FALLBACK_QUESTIONS);

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    return FALLBACK_QUESTIONS;
  }

  const validated = parsed.questions.filter(
    (q) =>
      typeof q.id === "string" &&
      typeof q.text === "string" &&
      VALID_QUESTION_TYPES.has(q.type) &&
      Array.isArray(q.options)
  );

  if (validated.length === 0) {
    return FALLBACK_QUESTIONS;
  }

  // Normalize branching fields and strip invalid references
  const questionIds = new Set(validated.map((q) => q.id));
  for (const q of validated) {
    if (q.branchFrom && !questionIds.has(q.branchFrom)) {
      q.branchFrom = null;
      q.branchCondition = null;
    }
    if (!q.branchFrom) {
      q.branchFrom = null;
      q.branchCondition = null;
    }
  }

  return { questions: validated };
}

app.post("/api/generate-questions", async (req, res) => {
  const { surveyDraft, variableModel } = req.body || {};

  try {
    let result = await callGeminiForQuestions(surveyDraft, variableModel);

    if (!Array.isArray(result.questions) || result.questions.length === 0) {
      return res.json(result);
    }

    // Auto-evaluation disabled to prevent rate limiting
    // Use the "Run Quality Check" button to evaluate manually
    return res.json({
      ...result,
      evaluations: null,
      regenerated: false
    });

    // ── Automatic evaluation (commented out to avoid rate limits) ──
    // try {
    //   const topic = surveyDraft?.goal || surveyDraft?.title || "general survey";
    //   const evaluations = await evaluateQuestions(topic, result.questions, callGemma);
    //
    //   if (needRegeneration(evaluations)) {
    //     const feedback = buildRegenerationFeedback(evaluations, topic);
    //     const improvedResult = await callGeminiForQuestions(
    //       { ...surveyDraft, feedback },
    //       variableModel
    //     );
    //     const improvedEvals = await evaluateQuestions(
    //       topic,
    //       improvedResult.questions || result.questions,
    //       callGemma
    //     );
    //     return res.json({
    //       ...improvedResult,
    //       evaluations: improvedEvals,
    //       regenerated: true
    //     });
    //   }
    //
    //   return res.json({
    //     ...result,
    //     evaluations,
    //     regenerated: false
    //   });
    //
    // } catch (evalErr) {
    //   console.error("Evaluation failed, returning questions without eval:", evalErr);
    //   return res.json(result);
    // }

  } catch (err) {
    console.error("Error in /api/generate-questions:", err);
    res.status(500).json(FALLBACK_QUESTIONS);
  }
});

app.post("/api/variable-model", async (req, res) => {
  const input = req.body || {};

  try {
    const model = await callGeminiForVariableModel(input);
    res.json({
      dependent: model.dependent,
      drivers: model.drivers,
      controls: model.controls
    });
  } catch (err) {
    console.error("Error in /api/variable-model:", err);
    res.status(500).json(FALLBACK_VARIABLE_MODEL);
  }
});

app.post("/api/extract-survey-config", async (req, res) => {
  const content = typeof req.body?.content === "string" ? req.body.content : "";

  try {
    const config = await callGeminiForSurveyConfig(content);
    res.json(config);
  } catch (err) {
    console.error("Error in /api/extract-survey-config:", err);
    res.status(500).json(HEALTHCARE_EXAMPLE_SURVEY);
  }
});

app.post("/api/evaluate-questions", async (req, res) => {
  const { questions, topic } = req.body || {};

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "No questions provided" });
  }

  try {
    const evaluations = await evaluateQuestions(
      topic || "general survey",
      questions,
      callOpenRouter
    );
    res.json({ evaluations });
  } catch (err) {
    console.error("Error in /api/evaluate-questions:", err);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
