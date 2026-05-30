import { getLangStr, fillTemplate } from "./utils.js";

const CHAT_SYSTEM_TEMPLATE = `You are a helpful survey methodology consultant and expert questionnaire designer. Your role is to assist users in creating high-quality surveys.

You can help with:
1. **Clarifying survey requirements** - Help users refine their survey scope, goal, and population
2. **Explaining quality issues** - When questions fail quality checks, explain the issues in plain language
3. **Suggesting improvements** - Recommend how to improve question wording, tone, or structure
4. **Regenerating questions** - When users provide feedback, help generate better questions
5. **Offering guidance** - Answer questions about survey design best practices

Current Context:
- Survey: {{surveyTitle}} (Goal: {{surveyGoal}})
- Population: {{population}}
- Current step: Step {{currentStep}} of 8
- Variable model: Dependent={{dependent}}, Drivers={{drivers}}, Controls={{controls}}

When a user provides feedback about questions (e.g., "Make them simpler" or "Focus on satisfaction"), acknowledge their feedback and prepare to regenerate with those improvements in mind.

Keep responses concise, friendly, and professional. Use the user's language (ask in English, respond in English).`;

export function buildChatSystemPrompt(context) {
  const { surveyDraft = {}, variableModel = {}, currentStep = 1 } = context || {};

  const title     = surveyDraft.title      || "Untitled Survey";
  const goal      = surveyDraft.goal       || "Not specified";
  const population = surveyDraft.population || "Not specified";
  const dependent = Array.isArray(variableModel.dependent) ? variableModel.dependent.join(", ") : "Not specified";
  const drivers   = Array.isArray(variableModel.drivers)   ? variableModel.drivers.join(", ")   : "Not specified";
  const controls  = Array.isArray(variableModel.controls)  ? variableModel.controls.join(", ")  : "Not specified";

  return fillTemplate(CHAT_SYSTEM_TEMPLATE, {
    surveyTitle: title, surveyGoal: goal, population,
    currentStep, dependent, drivers, controls,
  });
}

export function buildAddQuestionsUserPrompt(surveyDraft, variableModel, existingQuestions, count) {
  const {
    title = "", goal = "", population = "", language = [], tone = "",
  } = surveyDraft || {};

  const model     = variableModel || {};
  const dependent = Array.isArray(model.dependent) ? model.dependent.join(", ") : "";
  const drivers   = Array.isArray(model.drivers)   ? model.drivers.join(", ")   : "";
  const controls  = Array.isArray(model.controls)  ? model.controls.join(", ")  : "";

  const existingTexts = Array.isArray(existingQuestions) && existingQuestions.length > 0
    ? existingQuestions.map((q, i) => `- q${i + 1}: "${q.text}" (${q.type})`).join("\n")
    : "None";

  const nextId = (existingQuestions?.length || 0) + 1;
  const langStr = getLangStr(language);
  const langInstruction = langStr === "Arabic"
    ? "\nIMPORTANT: All question text and answer options MUST be written in Arabic (العربية). Do not use English anywhere in the questions or options."
    : "";

  return `Add exactly ${count} new survey question(s) to supplement the existing survey below.

═══ SURVEY CONFIGURATION ═══
- Title: ${title}
- Goal: ${goal}
- Population: ${population}
- Language(s): ${langStr}
- Tone: ${tone}${langInstruction}

═══ VARIABLE MODEL ═══
Dependent variable(s): ${dependent}
Driver variables: ${drivers}
Control variables: ${controls}

═══ EXISTING QUESTIONS (DO NOT DUPLICATE) ═══
${existingTexts}

Generate EXACTLY ${count} new question(s) that do not duplicate the questions above. Assign IDs starting from q${nextId}. Return ONLY the JSON object with a "questions" array containing exactly ${count} item(s).`;
}

export function buildRegenerationFeedbackPrompt(userFeedback, evaluations) {
  const issues = evaluations
    ? evaluations
        .filter(e => e.hasIssues)
        .map(e => `- Q${e.questionId}: ${e.issues.join(", ")}`)
        .join("\n")
    : "";

  const body = issues
    ? `Current quality issues:\n${issues}\n\nPlease regenerate the questions addressing the user feedback above and resolving these quality issues.`
    : "Please regenerate the questions based on the user feedback above.";

  return `User feedback for regeneration:\n"${userFeedback}"\n\n${body}`;
}
