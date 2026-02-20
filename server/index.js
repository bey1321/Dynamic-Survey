import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// import { GoogleGenAI } from "@google/genai";
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
import { GoogleGenAI } from "@google/genai";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// Debug: Check if env vars are loaded
console.log("🔍 DEBUG - Checking env variables:");
console.log("open_router:", process.env.open_router ? "✓ Loaded" : "✗ Missing");
console.log("model:", process.env.model ? "✓ Loaded" : "✗ Missing");

const app = express();
app.use(cors());
app.use(express.json());

// // ── Gemini (commented out) ──────────────────────────────────────────
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
//  const rawModel = process.env.GEMINI_MODEL;
//  const GEMINI_MODEL = rawModel
//   ? String(rawModel).replace(/^\s+|\s+$/g, "").replace(/^['"]+|['"]+$/g, "").replace(/,+$/g, "")
//   : "gemini-1.5-pro";

// const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
//  console.log("Using GEMINI_MODEL:", GEMINI_MODEL);

// async function callGemini(inputPrompt, systemPrompt, fallbackValue, isRetry = false) {
//    if (!ai) return fallbackValue;

//    const prompt = isRetry
//      ? `${systemPrompt}\n\n${inputPrompt}\n\nReturn ONLY valid JSON.`
//      : `${systemPrompt}\n\n${inputPrompt}`;

//    const response = await ai.models.generateContent({
//      model: GEMINI_MODEL,
//      contents: prompt
//    });

//    const text = response.text || "";

//    try {
//      return JSON.parse(text);
//    } catch (err) {
//      if (!isRetry) {
//        return await callGemini(inputPrompt, systemPrompt, fallbackValue, true);
//      }
//      return fallbackValue;
//    }
//  }


// OpenRouter / Gemma 
const OPENROUTER_API_KEY = process.env.open_router;
const GEMMA_MODEL = process.env.model || "google/gemma-3-27b-it:free";

console.log("Using model:", GEMMA_MODEL);
console.log("OpenRouter key loaded:", OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.slice(0, 10)}…` : "MISSING");

async function callGemma(inputPrompt, systemPrompt, fallbackValue, isRetry = false) {
 if (!OPENROUTER_API_KEY) {
   console.error("❌ OpenRouter API key is missing!");
   return fallbackValue;
  }

  const userContent = isRetry
   ? `${inputPrompt}\n\nReturn ONLY valid JSON.`
    : inputPrompt;

  console.log("🔄 Calling OpenRouter API with model:", GEMMA_MODEL);

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
      console.error("❌ OpenRouter API error:", res.status, errorText);
      return fallbackValue;
    }

    const data = await res.json();
    console.log("✅ OpenRouter response received");

   const text = data?.choices?.[0]?.message?.content || "";

   if (!text) {
     console.error("❌ Empty response from OpenRouter:", JSON.stringify(data, null, 2));
     return fallbackValue;
    }

    // Strip markdown code fences the model may wrap around JSON
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      console.log("✅ Successfully parsed JSON response");
      return parsed;
    } catch (err) {
      console.error("❌ JSON parse error:", err.message);
      console.error("Raw text:", text.substring(0, 200));
      if (!isRetry) {
        console.log("🔄 Retrying with explicit JSON instruction...");
        return await callGemma(inputPrompt, systemPrompt, fallbackValue, true);
     }
      return fallbackValue;
    }
  } catch (err) {
   console.error("❌ Fetch error:", err);
    return fallbackValue;
  }
}

async function callGemmaForVariableModel(input) {
  const userPrompt = buildVariableModelUserPrompt(input);
  const parsed = await callGemma(userPrompt, VARIABLE_MODEL_SYSTEM_PROMPT, FALLBACK_VARIABLE_MODEL);

  if (!Array.isArray(parsed.dependent) || !Array.isArray(parsed.drivers) || !Array.isArray(parsed.controls)) {
    return FALLBACK_VARIABLE_MODEL;
  }

  return parsed;
}

async function callGemmaForSurveyConfig(text) {
  const userPrompt = buildSurveyConfigUserPrompt(text);
  const parsed = await callGemma(userPrompt, SURVEY_CONFIG_SYSTEM_PROMPT, HEALTHCARE_EXAMPLE_SURVEY);

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

// Helper function to remove questions by index or position
function removeQuestionsFromList(questions, message = "", count = 1) {
  if (!Array.isArray(questions) || questions.length === 0) return questions;

  const lowerMsg = message.toLowerCase();
  const toRemove = Math.min(count, questions.length - 1); // Keep at least 1

  // Check for specific position keywords
  if (/first|[#1]/.test(lowerMsg)) {
    // Remove first N questions
    return questions.slice(toRemove);
  } else if (/last/.test(lowerMsg)) {
    // Remove last N questions
    return questions.slice(0, questions.length - toRemove);
  } else if (/middle|center/.test(lowerMsg)) {
    // Remove from middle
    const start = Math.floor(questions.length / 2);
    return [...questions.slice(0, start), ...questions.slice(start + toRemove)];
  } else {
    // Default: remove from end
    return questions.slice(0, questions.length - toRemove);
  }
}

// Helper function to add random questions
async function addQuestionsToList(questions, surveyDraft, variableModel, count = 1) {
  if (!Array.isArray(questions)) return questions;

  try {
    const result = await callGemmaForQuestions(surveyDraft, variableModel, questions);
    if (Array.isArray(result.questions)) {
      // Only add the new questions that weren't in the original set
      const newQuestions = result.questions.slice(Math.max(0, result.questions.length - count));
      return [...questions, ...newQuestions];
    }
  } catch (err) {
    console.error("Failed to add questions:", err);
  }
  return questions;
}

async function callGemmaForQuestions(surveyDraft, variableModel, previousQuestions = null) {
  const userPrompt = buildQuestionGenUserPrompt(surveyDraft, variableModel, previousQuestions);
  const parsed = await callGemma(userPrompt, QUESTION_GEN_SYSTEM_PROMPT, FALLBACK_QUESTIONS);

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
// MAX_REGEN_ATTEMPTS: Reduced to 2 for efficiency
// Attempt 1 = initial generation + evaluation
// Attempt 2 = fast regeneration check based on rule violations only
// ---------------------------------------------------------------------------
const MAX_REGEN_ATTEMPTS = 2;

app.post("/api/generate-questions", async (req, res) => {
  const { surveyDraft, variableModel, previousQuestions } = req.body || {};

  try {
    const topic = surveyDraft?.goal || surveyDraft?.title || "general survey";
    let currentResult = await callGemmaForQuestions(surveyDraft, variableModel, previousQuestions);

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
        if (e.llm_scores.relevance    < 4) count++;
        if (e.llm_scores.clarity      < 4) count++;
        if (e.llm_scores.neutrality   < 4) count++;
        if (e.llm_scores.answerability < 4) count++;
        count += (e.rule_violations?.length || 0);
        count += (e.response_option_issues?.length || 0);
        if (e.max_duplicate_similarity > 0.85) count++;
        if (e.skip_logic_issue)    count++;
        if (e.response_scale_issue) count++;
      }
      return count;
    }

    try {
      for (let attempt = 1; attempt <= MAX_REGEN_ATTEMPTS; attempt++) {
        attemptsMade = attempt;

        // Only evaluate on last attempt to save API calls
        let evals = null;
        if (attempt === MAX_REGEN_ATTEMPTS) {
          evals = await evaluateQuestions(topic, currentResult.questions, callGemma);
        } else {
          // Quick validation without LLM scoring for earlier attempts
          console.log(`[Attempt ${attempt}] Skipping full evaluation to save API calls...`);
          bestResult = currentResult;
          const feedback = buildRegenerationFeedback([], topic);
          currentResult = await callGemmaForQuestions({ ...surveyDraft, feedback }, variableModel, previousQuestions);
          regenerated = true;
          if (!Array.isArray(currentResult.questions) || currentResult.questions.length === 0) break;
          continue;
        }

        const issueCount = countIssues(evals);
        console.log(`[Attempt ${attempt}] issues: ${issueCount}, needRegeneration: ${needRegeneration(evals)}`);

        if (issueCount < bestIssueCount) {
          bestIssueCount = issueCount;
          bestResult = currentResult;
          bestEvals = evals;
        }

        if (!needRegeneration(evals)) break;

        if (attempt === MAX_REGEN_ATTEMPTS) {
          console.warn(`[Attempt ${attempt}] Max attempts reached. Best had ${bestIssueCount} issue(s).`);
          break;
        }
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
    // Build context-aware system prompt
    const systemPrompt = buildChatSystemPrompt(context);

    // Detect intent from message (add, remove, edit, regenerate questions)
    const lowerMessage = message.toLowerCase();
    const hasAddIntent = /add|create|new question|more question|more|additional/i.test(lowerMessage);
    const hasRemoveIntent = /remove|delete|less question|fewer question|remove.*question|delete.*question/i.test(lowerMessage);
    const hasEditIntent = /simpler|shorter|longer|clearer|different|change|reword|modify|edit/i.test(lowerMessage);

    console.log("🔍 CHAT DEBUG:", { lowerMessage, hasRemoveIntent, hasAddIntent, hasEditIntent, questionCount: context.questions?.length });
    console.log("📋 context.questions structure:", {
      isArray: Array.isArray(context.questions),
      length: context.questions?.length,
      type: typeof context.questions,
      first3: context.questions?.slice(0, 3)?.map(q => ({ id: q.id, text: q.text?.substring(0, 30) }))
    });

    // If user wants to modify questions and has questions, handle it
    if ((hasAddIntent || hasRemoveIntent || hasEditIntent) && Array.isArray(context.questions) && context.questions.length > 0) {
      console.log("✅ Entering modification block");
      let modifiedQuestions = context.questions;
      let actionLabel = "modified";

      // Handle remove intent
      if (hasRemoveIntent) {
        console.log("🗑️  Handling REMOVE intent");
        // Extract number if mentioned (e.g., "remove 2 questions")
        const numberMatch = lowerMessage.match(/(\d+)/);
        const countToRemove = numberMatch ? parseInt(numberMatch[1]) : 1;
        console.log(`Removing ${countToRemove} questions from ${context.questions.length} total`);
        modifiedQuestions = removeQuestionsFromList(context.questions, lowerMessage, countToRemove);
        console.log(`After removal: ${modifiedQuestions.length} questions`);
        console.log(`First question after removal:`, modifiedQuestions[0]?.text?.substring(0, 40));
        actionLabel = `removed ${countToRemove}`;
      }
      // Handle add intent
      else if (hasAddIntent) {
        console.log("➕ Handling ADD intent");
        // Extract number if mentioned (e.g., "add 3 questions")
        const numberMatch = lowerMessage.match(/(\d+)/);
        const countToAdd = numberMatch ? parseInt(numberMatch[1]) : 1;
        modifiedQuestions = await addQuestionsToList(context.questions, context.surveyDraft, context.variableModel, countToAdd);
        actionLabel = `added ${countToAdd}`;
      }
      // Handle edit intent - regenerate with feedback
      else if (hasEditIntent) {
        console.log("✏️  Handling EDIT intent");
        const feedbackPrompt = buildRegenerationFeedbackPrompt(message, context.evaluations);
        const improvementResult = await callGemmaForQuestions(
          {
            ...context.surveyDraft,
            feedback: feedbackPrompt
          },
          context.variableModel,
          context.questions
        );
        if (improvementResult && Array.isArray(improvementResult.questions)) {
          modifiedQuestions = improvementResult.questions;
        }
        actionLabel = "updated";
      }

      // Re-number questions after modification
      const renumberedQuestions = modifiedQuestions.map((q, idx) => ({
        ...q,
        id: `q${idx + 1}`
      }));

      console.log("📤 Sending back response with", renumberedQuestions.length, "questions");
      console.log("📤 Response includes regeneratedQuestions:", Array.isArray(renumberedQuestions));
      console.log("📤 First renumbered question:", renumberedQuestions[0]?.id, "-", renumberedQuestions[0]?.text?.substring(0, 40));

      return res.json({
        message: `I've ${actionLabel} the questions. Here are the updated questions.`,
        action: "questions_regenerated",
        regeneratedQuestions: renumberedQuestions,
        regenerationFeedback: message,
      });
    } else {
      console.log("❌ Did NOT enter modification block. Conditions:", {
        hasIntent: hasAddIntent || hasRemoveIntent || hasEditIntent,
        isArray: Array.isArray(context.questions),
        hasLength: context.questions?.length > 0,
        questionsValue: context.questions
      });
    }

    // Handle explicit regeneration action
    if (action === "regenerate_questions" && Array.isArray(context.questions) && context.questions.length > 0) {
      const feedbackPrompt = buildRegenerationFeedbackPrompt(message, context.evaluations);

      // Generate improved questions
      const improvementResult = await callGemmaForQuestions(
        {
          ...context.surveyDraft,
          feedback: feedbackPrompt
        },
        context.variableModel,
        context.questions
      );

      if (improvementResult && Array.isArray(improvementResult.questions) && improvementResult.questions.length > 0) {
        const responseMessage =
          "I've regenerated the questions based on your feedback. The new questions aim to address your concerns while maintaining survey quality.";

        return res.json({
          message: responseMessage,
          action: "questions_regenerated",
          regeneratedQuestions: improvementResult.questions,
          regenerationFeedback: message,
        });
      }
    }

    // Standard chat response (no question modifications)
    const fullConversationHistory = [
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: "user", content: message }
    ];

    const messages = [
      { role: "system", content: systemPrompt },
      ...fullConversationHistory
    ];

    // Call Gemma for chat response
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
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
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

    res.json({
      message: chatMessage,
      action: "chat"
    });

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
