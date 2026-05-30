import { GoogleGenAI } from "@google/genai";
import {
  buildVariableModelUserPrompt,
  buildVariableModelSystemPrompt,
  SURVEY_CONFIG_SYSTEM_PROMPT,
  buildSurveyConfigUserPrompt,
  QUESTION_GEN_SYSTEM_PROMPT,
  buildQuestionGenUserPrompt,
} from "../prompts/promptTemplates.js";
import { FALLBACK_VARIABLE_MODEL, HEALTHCARE_EXAMPLE_SURVEY, FALLBACK_QUESTIONS } from "../data/demoData.js";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
export const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

console.log("Using model:", GEMINI_MODEL);
console.log("Gemini key loaded:", process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 10)}…` : "MISSING");

function isTransientError(err) {
  const msg = err.message || "";
  return msg.includes('"code":503') || msg.includes("UNAVAILABLE");
}

function isRateLimitError(err) {
  const msg = err.message || "";
  return msg.includes('"code":429') || msg.includes("RESOURCE_EXHAUSTED");
}

export async function callGemini(inputPrompt, systemPrompt, fallbackValue, isRetry = false, label = "unknown", attempt = 1) {
  if (!ai) {
    console.error("❌ Gemini API key is missing!");
    return fallbackValue;
  }

  const userContent = isRetry
    ? `${inputPrompt}\n\nReturn ONLY valid JSON.`
    : inputPrompt;

  const retryTag = isRetry ? " [RETRY]" : "";
  console.log(`\n📡 [API CALL] ${label}${retryTag}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
  console.log(`   Model  : ${GEMINI_MODEL}`);
  console.log(`   Prompt : ${inputPrompt.slice(0, 120).replace(/\n/g, " ")}…`);

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userContent,
      config: { systemInstruction: systemPrompt }
    });

    const text = response.text || "";

    if (!text) {
      console.error(`   ❌ [${label}] Empty response from Gemini`);
      return fallbackValue;
    }

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      console.log(`   ✅ [${label}] Success — JSON parsed`);
      return parsed;
    } catch (err) {
      console.error(`   ❌ [${label}] JSON parse error: ${err.message}`);
      console.error(`   Raw: ${text.substring(0, 200)}`);
      if (!isRetry) {
        console.log(`   🔁 [${label}] Retrying with explicit JSON instruction...`);
        return await callGemini(inputPrompt, systemPrompt, fallbackValue, true, label, attempt);
      }
      return fallbackValue;
    }
  } catch (err) {
    if (isRateLimitError(err)) {
      console.error(`   🚫 [${label}] Rate limit hit — not retrying to preserve quota.`);
      return fallbackValue;
    }
    if (isTransientError(err) && attempt < 4) {
      const delay = attempt * 3000;
      console.warn(`   ⚠️ [${label}] Transient error (attempt ${attempt}), retrying in ${delay / 1000}s…`);
      await new Promise((r) => setTimeout(r, delay));
      return await callGemini(inputPrompt, systemPrompt, fallbackValue, isRetry, label, attempt + 1);
    }
    console.error(`   ❌ [${label}] Gemini error: ${err.message}`);
    return fallbackValue;
  }
}

export async function callGeminiForVariableModel(input) {
  const userPrompt = buildVariableModelUserPrompt(input);
  const systemPrompt = buildVariableModelSystemPrompt(input?.language);
  const parsed = await callGemini(userPrompt, systemPrompt, FALLBACK_VARIABLE_MODEL, false, "Variable Model Generation");

  if (!Array.isArray(parsed.dependent) || !Array.isArray(parsed.drivers) || !Array.isArray(parsed.controls)) {
    return FALLBACK_VARIABLE_MODEL;
  }

  return parsed;
}

export async function callGeminiForSurveyConfig(text) {
  const userPrompt = buildSurveyConfigUserPrompt(text);
  const parsed = await callGemini(userPrompt, SURVEY_CONFIG_SYSTEM_PROMPT, HEALTHCARE_EXAMPLE_SURVEY, false, "Survey Config Extraction");

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

export async function callGeminiForQuestions(surveyDraft, variableModel, previousQuestions = null, attemptLabel = "Question Generation") {
  const userPrompt = buildQuestionGenUserPrompt(surveyDraft, variableModel, previousQuestions);
  const parsed = await callGemini(userPrompt, QUESTION_GEN_SYSTEM_PROMPT, FALLBACK_QUESTIONS, false, attemptLabel);

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

export async function callGeminiChat(contents, systemPrompt) {
  if (!ai) throw new Error("Gemini API key is missing");
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: { systemInstruction: systemPrompt },
  });
  return response.text || "";
}
