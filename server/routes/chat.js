import express from "express";
import { callGemini, callGeminiChat } from "../services/gemini.js";
import {
  buildChatSystemPrompt,
  EDIT_OPERATIONS_SYSTEM_PROMPT,
  buildEditOperationsUserPrompt,
} from "../prompts/promptTemplates.js";

const router = express.Router();

function renumberAndFixBranches(questions) {
  const idMap = {};
  questions.forEach((q, i) => { idMap[q.id] = `q${i + 1}`; });

  return questions.map((q, i) => {
    const newId = `q${i + 1}`;
    const newBranchFrom = q.branchFrom && idMap[q.branchFrom] ? idMap[q.branchFrom] : null;
    const newBranchCondition =
      q.branchCondition && newBranchFrom
        ? { ...q.branchCondition, questionId: newBranchFrom }
        : null;
    return { ...q, id: newId, branchFrom: newBranchFrom, branchCondition: newBranchCondition };
  });
}

function applyOperations(questions, operations) {
  let result = [...questions];

  for (const op of operations) {
    if (!op || typeof op.type !== "string") continue;

    switch (op.type) {
      case "add_question": {
        if (!op.updates || typeof op.updates.text !== "string") break;
        const newQ = {
          branchFrom: null,
          branchCondition: null,
          required: true,
          ...op.updates,
          id: `q_tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        };
        if (op.target) {
          const idx = result.findIndex((q) => q.id === op.target);
          result.splice(idx !== -1 ? idx + 1 : result.length, 0, newQ);
        } else {
          result.push(newQ);
        }
        break;
      }

      case "remove_question": {
        if (!op.target) break;
        const removedId = op.target;
        result = result
          .filter((q) => q.id !== removedId)
          .map((q) =>
            q.branchFrom === removedId
              ? { ...q, branchFrom: null, branchCondition: null }
              : q
          );
        break;
      }

      case "update_question": {
        if (!op.target) break;
        result = result.map((q) =>
          q.id === op.target ? { ...q, ...(op.updates || {}) } : q
        );
        break;
      }

      case "reorder_questions": {
        const order = op.updates?.order;
        if (!Array.isArray(order)) break;
        const byId = Object.fromEntries(result.map((q) => [q.id, q]));
        const reordered = order.map((id) => byId[id]).filter(Boolean);
        const inOrder = new Set(order);
        const rest = result.filter((q) => !inOrder.has(q.id));
        result = [...reordered, ...rest];
        break;
      }

      case "replace_question_type": {
        if (!op.target) break;
        result = result.map((q) =>
          q.id === op.target
            ? { ...q, type: op.updates?.type ?? q.type, options: op.updates?.options ?? [] }
            : q
        );
        break;
      }

      case "simplify_questions": {
        const simplified = op.updates?.questions;
        if (!Array.isArray(simplified)) break;
        const map = Object.fromEntries(simplified.map((s) => [s.id, s]));
        result = result.map((q) => (map[q.id] ? { ...q, ...map[q.id] } : q));
        break;
      }

      case "shorten_survey": {
        const toRemove = op.updates?.remove;
        if (!Array.isArray(toRemove)) break;
        const removeSet = new Set(toRemove);
        result = result.filter((q) => !removeSet.has(q.id));
        break;
      }

      default:
        break;
    }
  }

  return renumberAndFixBranches(result);
}

router.post("/chat", async (req, res) => {
  const { message, context = {}, conversationHistory = [], action = "chat" } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const hasQuestions = Array.isArray(context.questions) && context.questions.length > 0;

    if (hasQuestions && action !== "chat_only") {
      const userPrompt = buildEditOperationsUserPrompt(
        message,
        context.questions,
        context.surveyDraft,
        context.variableModel
      );

      const parsed = await callGemini(
        userPrompt,
        EDIT_OPERATIONS_SYSTEM_PROMPT,
        { message: "I'm unable to process that request right now.", operations: [] },
        false,
        "Chat — Edit Operations"
      );

      const operations = Array.isArray(parsed?.operations) ? parsed.operations : [];
      const replyMessage = typeof parsed?.message === "string" && parsed.message
        ? parsed.message
        : "Done.";

      if (operations.length > 0) {
        const updatedQuestions = applyOperations(context.questions, operations);
        console.log(`   ✏️  Applied ${operations.length} operation(s): ${operations.map((o) => o.type).join(", ")}`);

        return res.json({
          message: replyMessage,
          action: "questions_regenerated",
          regeneratedQuestions: updatedQuestions,
          operations,
        });
      }

      return res.json({ message: replyMessage, action: "chat" });
    }

    const systemPrompt = buildChatSystemPrompt(context);
    const contents = [
      ...conversationHistory.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const text = await callGeminiChat(contents, systemPrompt);

    res.json({
      message: text || "I'm unable to respond right now. Please try again.",
      action: "chat",
    });

  } catch (err) {
    console.error("Error in /api/chat:", err);
    res.status(500).json({
      message: "An error occurred while processing your request. Please try again.",
      action: "chat",
    });
  }
});

export default router;
