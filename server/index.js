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
  buildQuestionGenUserPrompt,
  buildChatSystemPrompt,
  buildRegenerationFeedbackPrompt
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

// ── OpenRouter ───────────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMMA_MODEL = process.env.GEMMA_MODEL || "mistralai/mistral-7b-instruct:free";

console.log("Using model:", GEMMA_MODEL);
console.log("OpenRouter key loaded:", OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.slice(0, 10)}…` : "MISSING");

async function callGemma(inputPrompt, systemPrompt, fallbackValue, isRetry = false, label = "unknown") {
  if (!OPENROUTER_API_KEY) {
    console.error("❌ OpenRouter API key is missing!");
    return fallbackValue;
  }

  const userContent = isRetry
    ? `${inputPrompt}\n\nReturn ONLY valid JSON.`
    : inputPrompt;

  const retryTag = isRetry ? " [RETRY]" : "";
  console.log(`\n📡 [API CALL] ${label}${retryTag}`);
  console.log(`   Model  : ${GEMMA_MODEL}`);
  console.log(`   Prompt : ${inputPrompt.slice(0, 120).replace(/\n/g, " ")}…`);

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
        model: GEMMA_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ]
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`   ❌ [${label}] HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      return fallbackValue;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";

    if (!text) {
      console.error(`   ❌ [${label}] Empty response from OpenRouter`);
      return fallbackValue;
    }

    // Strip markdown code fences the model may wrap around JSON
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
        return await callGemma(inputPrompt, systemPrompt, fallbackValue, true, label);
      }
      return fallbackValue;
    }
  } catch (err) {
    console.error(`   ❌ [${label}] Fetch error: ${err.message}`);
    return fallbackValue;
  }
}

// // ── Gemini (commented out) ───────────────────────────────────────────────
// import { GoogleGenAI } from "@google/genai";
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-pro";
// const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
// async function callGemini(...) { ... }

async function callGemmaForVariableModel(input) {
  const userPrompt = buildVariableModelUserPrompt(input);
  const parsed = await callGemma(userPrompt, VARIABLE_MODEL_SYSTEM_PROMPT, FALLBACK_VARIABLE_MODEL, false, "Variable Model Generation");

  if (!Array.isArray(parsed.dependent) || !Array.isArray(parsed.drivers) || !Array.isArray(parsed.controls)) {
    return FALLBACK_VARIABLE_MODEL;
  }

  return parsed;
}

async function callGemmaForSurveyConfig(text) {
  const userPrompt = buildSurveyConfigUserPrompt(text);
  const parsed = await callGemma(userPrompt, SURVEY_CONFIG_SYSTEM_PROMPT, HEALTHCARE_EXAMPLE_SURVEY, false, "Survey Config Extraction");

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

// Helper function to remove questions by position
function removeQuestionsFromList(questions, message = "", count = 1) {
  if (!Array.isArray(questions) || questions.length === 0) return questions;

  const lowerMsg = message.toLowerCase();
  const toRemove = Math.min(count, questions.length - 1);

  if (/first|[#1]/.test(lowerMsg)) {
    return questions.slice(toRemove);
  } else if (/last/.test(lowerMsg)) {
    return questions.slice(0, questions.length - toRemove);
  } else if (/middle|center/.test(lowerMsg)) {
    const start = Math.floor(questions.length / 2);
    return [...questions.slice(0, start), ...questions.slice(start + toRemove)];
  } else {
    return questions.slice(0, questions.length - toRemove);
  }
}

// Helper function to add questions
async function addQuestionsToList(questions, surveyDraft, variableModel, count = 1) {
  if (!Array.isArray(questions)) return questions;

  try {
    const result = await callGemmaForQuestions(surveyDraft, variableModel, questions, "Chat — Add Questions");
    if (Array.isArray(result.questions)) {
      const newQuestions = result.questions.slice(Math.max(0, result.questions.length - count));
      return [...questions, ...newQuestions];
    }
  } catch (err) {
    console.error("Failed to add questions:", err);
  }
  return questions;
}

async function callGemmaForQuestions(surveyDraft, variableModel, previousQuestions = null, attemptLabel = "Question Generation") {
  const userPrompt = buildQuestionGenUserPrompt(surveyDraft, variableModel, previousQuestions);
  const parsed = await callGemma(userPrompt, QUESTION_GEN_SYSTEM_PROMPT, FALLBACK_QUESTIONS, false, attemptLabel);

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
// ---------------------------------------------------------------------------
const MAX_REGEN_ATTEMPTS = 2;

app.post("/api/generate-questions", async (req, res) => {
  const { surveyDraft, variableModel, previousQuestions } = req.body || {};

  try {
    const topic = surveyDraft?.goal || surveyDraft?.title || "general survey";
    console.log(`\n🚀 [PIPELINE START] Topic: "${topic}"`);
    let currentResult = await callGemmaForQuestions(surveyDraft, variableModel, previousQuestions, "Question Generation [Attempt 1]");

    if (!Array.isArray(currentResult.questions) || currentResult.questions.length === 0) {
      return res.json(currentResult);
    }

    let bestResult = currentResult;
    let bestEvals = null;
    let bestIssueCount = Infinity;
    let attemptsMade = 0;
    let regenerated = false;

    function countIssues(evals) {
      let count = 0;
      for (const e of evals) {
        if (e.llm_scores.relevance     < 3) count++;
        if (e.llm_scores.clarity       < 3) count++;
        if (e.llm_scores.neutrality    < 3) count++;
        if (e.llm_scores.answerability < 3) count++;
        const minRelevance = e.variableRole === "control" ? 0.2 : 0.3;
        if (e.variable_relevance < minRelevance) count++;
        count += (e.rule_violations?.length || 0);
        count += (e.response_option_issues?.length || 0);
        if (e.max_duplicate_similarity > 0.85) count++;
        if (e.skip_logic_issue)     count++;
        if (e.response_scale_issue) count++;
      }
      return count;
    }

    try {
      for (let attempt = 1; attempt <= MAX_REGEN_ATTEMPTS; attempt++) {
        attemptsMade = attempt;
        console.log(`\n🔍 [EVALUATION] Attempt ${attempt}/${MAX_REGEN_ATTEMPTS} — evaluating ${currentResult.questions.length} questions`);
        const evals = await evaluateQuestions(topic, currentResult.questions, callGemma);
        const issueCount = countIssues(evals);
        const regen = needRegeneration(evals);

        console.log(`   Issues found : ${issueCount}`);
        console.log(`   Needs regen  : ${regen}`);

        if (issueCount < bestIssueCount) {
          bestIssueCount = issueCount;
          bestResult = currentResult;
          bestEvals = evals;
          console.log(`   ⭐ New best result saved (${issueCount} issue(s))`);
        }

        if (!regen) {
          console.log(`   ✅ Quality threshold met — stopping early`);
          break;
        }

        if (attempt === MAX_REGEN_ATTEMPTS) {
          console.warn(`   ⚠️  Max attempts reached. Best result had ${bestIssueCount} issue(s).`);
          break;
        }

        console.log(`\n♻️  [REGENERATION] Attempt ${attempt + 1}/${MAX_REGEN_ATTEMPTS} — regenerating with feedback`);
        const feedback = buildRegenerationFeedback(evals, topic);
        currentResult = await callGemmaForQuestions({ ...surveyDraft, feedback }, variableModel, previousQuestions, `Question Regeneration [Attempt ${attempt + 1}]`);
        regenerated = true;

        if (!Array.isArray(currentResult.questions) || currentResult.questions.length === 0) break;
      }

      return res.json({ ...bestResult, evaluations: bestEvals, regenerated, attemptsMade });

    } catch (evalErr) {
      console.error("Evaluation loop failed, returning questions without eval:", evalErr);
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
    const model = await callGemmaForVariableModel(input);
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
    const config = await callGemmaForSurveyConfig(content);
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
      callGemma
    );
    res.json({ evaluations });
  } catch (err) {
    console.error("Error in /api/evaluate-questions:", err);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, context = {}, conversationHistory = [], action = "chat" } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const systemPrompt = buildChatSystemPrompt(context);
    const lowerMessage = message.toLowerCase();
    const hasAddIntent = /add|create|new question|more question|more|additional/i.test(lowerMessage);
    const hasRemoveIntent = /remove|delete|less question|fewer question|remove.*question|delete.*question/i.test(lowerMessage);
    const hasEditIntent = /simpler|shorter|longer|clearer|different|change|reword|modify|edit/i.test(lowerMessage);

    // Handle question modifications
    if ((hasAddIntent || hasRemoveIntent || hasEditIntent) && Array.isArray(context.questions) && context.questions.length > 0) {
      let modifiedQuestions = context.questions;
      let actionLabel = "modified";

      if (hasRemoveIntent) {
        const numberMatch = lowerMessage.match(/(\d+)/);
        const countToRemove = numberMatch ? parseInt(numberMatch[1]) : 1;
        modifiedQuestions = removeQuestionsFromList(context.questions, lowerMessage, countToRemove);
        actionLabel = `removed ${countToRemove}`;
      } else if (hasAddIntent) {
        const numberMatch = lowerMessage.match(/(\d+)/);
        const countToAdd = numberMatch ? parseInt(numberMatch[1]) : 1;
        modifiedQuestions = await addQuestionsToList(context.questions, context.surveyDraft, context.variableModel, countToAdd);
        actionLabel = `added ${countToAdd}`;
      } else if (hasEditIntent) {
        const feedbackPrompt = buildRegenerationFeedbackPrompt(message, context.evaluations);
        const improvementResult = await callGemmaForQuestions(
          { ...context.surveyDraft, feedback: feedbackPrompt },
          context.variableModel,
          context.questions,
          "Chat — Edit/Improve Questions"
        );
        if (improvementResult && Array.isArray(improvementResult.questions)) {
          modifiedQuestions = improvementResult.questions;
        }
        actionLabel = "updated";
      }

      const renumberedQuestions = modifiedQuestions.map((q, idx) => ({
        ...q,
        id: `q${idx + 1}`
      }));

      return res.json({
        message: `I've ${actionLabel} the questions. Here are the updated questions.`,
        action: "questions_regenerated",
        regeneratedQuestions: renumberedQuestions,
        regenerationFeedback: message,
      });
    }

    // Handle explicit regeneration action
    if (action === "regenerate_questions" && Array.isArray(context.questions) && context.questions.length > 0) {
      const feedbackPrompt = buildRegenerationFeedbackPrompt(message, context.evaluations);
      const improvementResult = await callGemmaForQuestions(
        { ...context.surveyDraft, feedback: feedbackPrompt },
        context.variableModel,
        context.questions,
        "Chat — Explicit Regeneration"
      );

      if (improvementResult && Array.isArray(improvementResult.questions) && improvementResult.questions.length > 0) {
        return res.json({
          message: "I've regenerated the questions based on your feedback. The new questions aim to address your concerns while maintaining survey quality.",
          action: "questions_regenerated",
          regeneratedQuestions: improvementResult.questions,
          regenerationFeedback: message,
        });
      }
    }

    // Standard chat response via OpenRouter
    const fullConversationHistory = [
      ...conversationHistory.slice(-10),
      { role: "user", content: message }
    ];

    const messages = [
      { role: "system", content: systemPrompt },
      ...fullConversationHistory
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Dynamic Survey Generator"
      },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        messages: messages.map((m) => ({ role: m.role, content: m.content }))
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenRouter API error:", response.status, errorText);
      return res.json({
        message: "I apologize, but I couldn't process your request at this moment. Please try again.",
        action: "chat"
      });
    }

    const data = await response.json();
    const chatMessage = data.choices?.[0]?.message?.content || "I'm unable to respond right now. Please try again.";

    res.json({ message: chatMessage, action: "chat" });

  } catch (err) {
    console.error("Error in /api/chat:", err);
    res.status(500).json({
      message: "An error occurred while processing your request. Please try again.",
      action: "chat"
    });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
