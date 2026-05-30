import express from "express";
import { callGemini, callGeminiForQuestions } from "../services/gemini.js";
import { evaluateQuestions, needRegeneration, buildRegenerationFeedback } from "../services/evaluator/index.js";

const router = express.Router();

const MAX_REGEN_ATTEMPTS = 2;

router.post("/generate-questions", async (req, res) => {
  const { surveyDraft, variableModel, previousQuestions } = req.body || {};

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function emitStage(stage, message) {
    res.write(`data: ${JSON.stringify({ type: "stage", stage, message })}\n\n`);
  }

  function emitDone(payload) {
    res.write(`data: ${JSON.stringify({ type: "done", ...payload })}\n\n`);
    res.end();
  }

  function emitError(message) {
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    res.end();
  }

  try {
    emitStage("Input Analysis", "Parsing survey topic, goals, and variable model…");
    const topic = surveyDraft?.goal || surveyDraft?.title || "general survey";
    console.log(`\n🚀 [PIPELINE START] Topic: "${topic}"`);

    emitStage("Draft Generation", "Generating initial question set from survey specification…");
    let currentResult = await callGeminiForQuestions(surveyDraft, variableModel, previousQuestions, "Question Generation [Attempt 1]");

    if (!Array.isArray(currentResult.questions) || currentResult.questions.length === 0) {
      return emitDone(currentResult);
    }

    let bestResult = currentResult;
    let bestEvals = null;
    let bestIssueCount = Infinity;
    let attemptsMade = 0;
    let regenerated = false;

    function countIssues(evals) {
      let count = 0;
      for (const e of evals) {
        const avgLLM = (e.llm_scores.clarity + e.llm_scores.neutrality + e.llm_scores.answerability + e.llm_scores.relevance) / 4;
        if (avgLLM < 3.0) count++;
        const minRelevance = e.variableRole === "control" ? 0.2 : 0.3;
        if (e.variable_relevance < minRelevance) count++;
        count += (e.rule_violations?.length || 0);
        count += (e.response_option_issues?.length || 0);
        if (e.max_duplicate_similarity > 0.90) count++;
        if (e.skip_logic_issue)     count++;
        if (e.response_scale_issue) count++;
        if (e.readability !== null && e.readability < 20) count++;
      }
      return count;
    }

    try {
      for (let attempt = 1; attempt <= MAX_REGEN_ATTEMPTS; attempt++) {
        attemptsMade = attempt;

        const qCount = currentResult.questions.length;
        emitStage(
          "Internal Review",
          `Evaluating ${qCount} question${qCount !== 1 ? "s" : ""} for clarity, neutrality, relevance, and bias…`
        );
        console.log(`\n🔍 [EVALUATION] Attempt ${attempt}/${MAX_REGEN_ATTEMPTS} — evaluating ${qCount} questions`);
        const { results: evals, coverageIssues } = await evaluateQuestions(
          topic, currentResult.questions, callGemini, variableModel, surveyDraft?.language
        );
        const issueCount = countIssues(evals);
        const regen = needRegeneration(evals, {}, coverageIssues);

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

        emitStage(
          "Refinement",
          `${issueCount} issue${issueCount !== 1 ? "s" : ""} detected — regenerating with targeted feedback…`
        );
        console.log(`\n♻️  [REGENERATION] Attempt ${attempt + 1}/${MAX_REGEN_ATTEMPTS} — regenerating with feedback`);
        const feedback = buildRegenerationFeedback(evals, topic, coverageIssues);
        currentResult = await callGeminiForQuestions({ ...surveyDraft, feedback }, variableModel, previousQuestions, `Question Regeneration [Attempt ${attempt + 1}]`);
        regenerated = true;

        if (!Array.isArray(currentResult.questions) || currentResult.questions.length === 0) break;
      }

      emitStage("Final Approval", "Quality checks passed — preparing final question set…");
      return emitDone({ ...bestResult, evaluations: bestEvals, regenerated, attemptsMade });

    } catch (evalErr) {
      console.error("Evaluation loop failed, returning questions without eval:", evalErr);
      emitStage("Final Approval", "Evaluation skipped — returning generated questions…");
      return emitDone(currentResult);
    }

  } catch (err) {
    console.error("Error in /api/generate-questions:", err);
    return emitError("Question generation failed. Check server logs.");
  }
});

router.post("/evaluate-questions", async (req, res) => {
  const { questions, topic, variableModel, language } = req.body || {};

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "No questions provided" });
  }

  try {
    const { results: evaluations, coverageIssues } = await evaluateQuestions(
      topic || "general survey",
      questions,
      callGemini,
      variableModel || null,
      language || "English"
    );
    res.json({ evaluations, coverageIssues });
  } catch (err) {
    console.error("Error in /api/evaluate-questions:", err);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

export default router;
