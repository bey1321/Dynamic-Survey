import {
  buildVariableModelUserPrompt,
  buildVariableModelSystemPrompt,
  SURVEY_CONFIG_SYSTEM_PROMPT,
  buildSurveyConfigUserPrompt,
  QUESTION_GEN_SYSTEM_PROMPT,
  buildQuestionGenUserPrompt,
} from "../prompts/promptTemplates.js";
import { FALLBACK_VARIABLE_MODEL, HEALTHCARE_EXAMPLE_SURVEY, FALLBACK_QUESTIONS } from "../data/demoData.js";

export const GEMINI_MODEL = process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.6:free";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

console.log("Using model:", GEMINI_MODEL);
console.log("OpenRouter key loaded:", OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.slice(0, 10)}…` : "MISSING");

function isTransientError(status) {
  return status === 503 || status === 502;
}

function isRateLimitError(status) {
  return status === 429;
}

async function openRouterRequest(messages) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let res;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dynamic-survey.app",
        "X-Title": "Dynamic Survey",
      },
      body: JSON.stringify({ model: GEMINI_MODEL, messages }),
    });
  } catch (fetchErr) {
    const networkErr = new Error(`fetch failed: ${fetchErr.cause?.message || fetchErr.message}`);
    networkErr.isNetwork = true;
    throw networkErr;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const err = new Error(`OpenRouter HTTP ${res.status}`);
    err.status = res.status;
    err.body = await res.text().catch(() => "");
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function callGemini(inputPrompt, systemPrompt, fallbackValue, isRetry = false, label = "unknown", attempt = 1, rateLimitAttempt = 1) {
  if (!OPENROUTER_API_KEY) {
    console.error("❌ OpenRouter API key is missing!");
    return fallbackValue;
  }

  const userContent = isRetry ? `${inputPrompt}\n\nReturn ONLY valid JSON.` : inputPrompt;
  const retryTag = isRetry ? " [RETRY]" : "";
  console.log(`\n📡 [API CALL] ${label}${retryTag}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
  console.log(`   Model  : ${GEMINI_MODEL}`);
  console.log(`   Prompt : ${inputPrompt.slice(0, 120).replace(/\n/g, " ")}…`);

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  try {
    const text = await openRouterRequest(messages, label);

    if (!text) {
      console.error(`   ❌ [${label}] Empty response`);
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
    if (isRateLimitError(err.status)) {
      if (rateLimitAttempt < 3) {
        const delay = rateLimitAttempt * 20000;
        console.warn(`   ⏳ [${label}] Rate limit hit (attempt ${rateLimitAttempt}), waiting ${delay / 1000}s before retry…`);
        await new Promise((r) => setTimeout(r, delay));
        return await callGemini(inputPrompt, systemPrompt, fallbackValue, isRetry, label, attempt, rateLimitAttempt + 1);
      }
      console.error(`   🚫 [${label}] Rate limit hit after ${rateLimitAttempt} attempts — using fallback.`);
      return fallbackValue;
    }
    if ((isTransientError(err.status) || err.isNetwork) && attempt < 4) {
      const delay = attempt * 5000;
      console.warn(`   ⚠️ [${label}] Network/transient error (attempt ${attempt}), retrying in ${delay / 1000}s…`);
      console.warn(`   ⚠️ Cause: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
      return await callGemini(inputPrompt, systemPrompt, fallbackValue, isRetry, label, attempt + 1, rateLimitAttempt);
    }
    console.error(`   ❌ [${label}] OpenRouter error: ${err.message}`);
    if (err.body) console.error(`   ❌ Response body: ${err.body.substring(0, 300)}`);
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
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key is missing");

  // Convert Gemini-format contents to OpenAI messages
  const messages = [
    { role: "system", content: systemPrompt },
    ...contents.map((c) => ({
      role: c.role === "model" ? "assistant" : "user",
      content: Array.isArray(c.parts) ? c.parts.map((p) => p.text || "").join("") : (c.content || ""),
    })),
  ];

  return await openRouterRequest(messages, "Chat");
}

// Keep named export for legacy compatibility
export const ai = null;
