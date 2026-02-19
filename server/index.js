import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
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

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const rawModel = process.env.GEMINI_MODEL;
const GEMINI_MODEL = rawModel
  ? String(rawModel).replace(/^\s+|\s+$/g, "").replace(/^['"]+|['"]+$/g, "").replace(/,+$/g, "")
  : "gemini-1.5-pro";

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

console.log("Using GEMINI_MODEL:", GEMINI_MODEL);

async function callGemini(inputPrompt, systemPrompt, fallbackValue, isRetry = false) {
  if (!ai) {
    return fallbackValue;
  }

  const prompt = isRetry
    ? `${systemPrompt}\n\n${inputPrompt}\n\nReturn ONLY valid JSON.`
    : `${systemPrompt}\n\n${inputPrompt}`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt
  });

  const text = response.text || "";

  try {
    return JSON.parse(text);
  } catch (err) {
    if (!isRetry) {
      return await callGemini(inputPrompt, systemPrompt, fallbackValue, true);
    }
    return fallbackValue;
  }
}

async function callGeminiForVariableModel(input) {
  const userPrompt = buildVariableModelUserPrompt(input);
  const parsed = await callGemini(userPrompt, VARIABLE_MODEL_SYSTEM_PROMPT, FALLBACK_VARIABLE_MODEL);

  if (!Array.isArray(parsed.dependent) || !Array.isArray(parsed.drivers) || !Array.isArray(parsed.controls)) {
    return FALLBACK_VARIABLE_MODEL;
  }

  return parsed;
}

async function callGeminiForSurveyConfig(text) {
  const userPrompt = buildSurveyConfigUserPrompt(text);
  const parsed = await callGemini(userPrompt, SURVEY_CONFIG_SYSTEM_PROMPT, HEALTHCARE_EXAMPLE_SURVEY);

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
  const parsed = await callGemini(userPrompt, QUESTION_GEN_SYSTEM_PROMPT, FALLBACK_QUESTIONS);

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

// ---------------------------------------------------------------------------
// MAX_REGEN_ATTEMPTS: how many times we'll try to improve questions before
// giving up and returning the best result so far.
// Attempt 1 = initial generation
// Attempts 2..MAX = regeneration rounds
// ---------------------------------------------------------------------------
const MAX_REGEN_ATTEMPTS = 4;

app.post("/api/generate-questions", async (req, res) => {
  const { surveyDraft, variableModel } = req.body || {};

  try {
    const topic = surveyDraft?.goal || surveyDraft?.title || "general survey";

    let currentResult = await callGeminiForQuestions(surveyDraft, variableModel);

    if (!Array.isArray(currentResult.questions) || currentResult.questions.length === 0) {
      return res.json(currentResult);
    }

    let currentEvals = null;
    let attemptsMade = 0;
    let regenerated = false;

    try {
      // Evaluate → regenerate loop
      for (let attempt = 1; attempt <= MAX_REGEN_ATTEMPTS; attempt++) {
        attemptsMade = attempt;

        const evals = await evaluateQuestions(topic, currentResult.questions, callGemini);
        currentEvals = evals;

        console.log(`[Attempt ${attempt}] needRegeneration: ${needRegeneration(evals)}`);

        // Questions are clean — stop here
        if (!needRegeneration(evals)) {
          break;
        }

        // Reached the limit — return best result so far
        if (attempt === MAX_REGEN_ATTEMPTS) {
          console.warn(`[Attempt ${attempt}] Max regeneration attempts reached. Returning best result.`);
          break;
        }

        // Build feedback and regenerate
        const feedback = buildRegenerationFeedback(evals, topic);
        console.log(`[Attempt ${attempt}] Regenerating with feedback…`);
        currentResult = await callGeminiForQuestions(
          { ...surveyDraft, feedback },
          variableModel
        );
        regenerated = true;

        if (!Array.isArray(currentResult.questions) || currentResult.questions.length === 0) {
          console.warn(`[Attempt ${attempt}] Regeneration returned empty questions. Stopping.`);
          break;
        }
      }

      return res.json({
        ...currentResult,
        evaluations: currentEvals,
        regenerated,
        attemptsMade
      });

    } catch (evalErr) {
      // Evaluation pipeline failed — still return questions without eval
      console.error("Evaluation/regeneration loop failed, returning questions without eval:", evalErr);
      return res.json(currentResult);
    }

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
      callGemini
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