export const VARIABLE_MODEL_SYSTEM_PROMPT = `You are an expert survey methodologist and government statistics analyst.
Return ONLY valid JSON. No markdown. No explanation.`;

export const VARIABLE_MODEL_USER_PROMPT_TEMPLATE = `Generate a survey Variable Model (measurement model) for the following official survey.
Context:
- Title: {{title}}
- Goal: {{goal}}
- Population: {{population}}
- Confidence: {{confidence}}%
- Margin: ±{{margin}}%
- Language(s): {{language}}
- Tone: {{tone}}
- Max questions: {{maxQuestions}}

Output JSON schema (STRICT):
{
  "dependent": ["..."],
  "drivers": ["...", "..."],
  "controls": ["...", "..."]
}

Rules:
- dependent: the main outcome the survey measures (e.g., overall satisfaction score).
- drivers: measurable factors that influence the dependent variable (5–7 items).
- controls: demographic/context variables for segmentation (4–6 items).
- Use neutral, government-appropriate wording.
- Keep each item short (2–6 words).`;

export function buildVariableModelUserPrompt(input) {
  const {
    title = "",
    goal = "",
    population = "",
    confidence = "",
    margin = "",
    language = "",
    tone = "",
    maxQuestions = ""
  } = input || {};

  return VARIABLE_MODEL_USER_PROMPT_TEMPLATE
    .replace("{{title}}", title)
    .replace("{{goal}}", goal)
    .replace("{{population}}", population)
    .replace("{{confidence}}", String(confidence))
    .replace("{{margin}}", String(margin))
    .replace("{{language}}", Array.isArray(language) ? language.join(" + ") : String(language))
    .replace("{{tone}}", tone)
    .replace("{{maxQuestions}}", String(maxQuestions));
}

export const SURVEY_CONFIG_SYSTEM_PROMPT = `You are an expert survey methodologist and government statistics analyst.
Return ONLY valid JSON. No markdown. No explanation.`;

export const SURVEY_CONFIG_USER_PROMPT_TEMPLATE = `Given the following survey specification text, extract the core survey configuration fields.

Text:
{{text}}

Output JSON schema (STRICT):
{
  "title": "...",
  "goal": "...",
  "population": "...",
  "confidence": "90" | "95" | "99",
  "margin": "3" | "5" | "7",
  "language": ["English", "Arabic"],
  "tone": "...",
  "maxQuestions": 10
}

Rules:
- Map any confidence level to the closest of 90, 95, or 99.
- Map any margin of error to the closest of 3, 5, or 7 (percent).
- language must be an array of one or both of: "English", "Arabic".
- tone should be a short description like "Neutral / Government", "Friendly", or "Formal".
- maxQuestions should be an integer if present, otherwise use a reasonable default (such as 10).
- If a field is missing in the text, leave it empty or use a sensible default.`;

export function buildSurveyConfigUserPrompt(text) {
  const safeText = text || "";
  return SURVEY_CONFIG_USER_PROMPT_TEMPLATE.replace("{{text}}", safeText);
}

/* ------------------------------------------------------------------ */
/*  Question Generation Prompt                                        */
/* ------------------------------------------------------------------ */

export const QUESTION_GEN_SYSTEM_PROMPT = `You are an expert survey methodologist specialising in questionnaire design for government and institutional research.

═══ ROLE & GUARDRAILS ═══
• You ONLY generate survey questions. If the request is unrelated to survey design (e.g., jokes, code, essays), return: {"questions":[]}.
• Never include personally identifiable information (PII), offensive language, or leading/biased phrasing.
• All wording must be neutral, clear, and appropriate for the specified tone.

═══ SURVEY DESIGN PRINCIPLES ═══
Follow these ordering rules:
1. Start with DEMOGRAPHIC / CONTROL questions (age, gender, area, etc.) to establish respondent context.
2. Then ask BROAD / GENERAL questions about the dependent variable (overall satisfaction, main outcome).
3. Then move to SPECIFIC DRIVER questions that measure individual factors influencing the outcome.
4. Within each section, order from easiest to hardest to answer.
5. Each question must map to exactly one variable from the provided variable model.
6. Respect the maximum question count — distribute questions proportionally:
   • ~1 question per control variable (demographics — placed first)
   • 1 question per dependent variable
   • ~1 question per driver (prioritise the most impactful)

═══ ALLOWED QUESTION TYPES ═══
You may ONLY use the following types. Choose the best fit for each variable:

| type             | When to use                                                         | options rule                                      |
|------------------|---------------------------------------------------------------------|---------------------------------------------------|
| likert           | Measuring attitudes, satisfaction, agreement on a scale             | Exactly 5 options: "1 - <low label>" … "5 - <high label>" |
| multiple_choice  | Selecting ONE option from a set of discrete categories              | 3–7 mutually exclusive options                    |
| multi_select     | Selecting ONE OR MORE options that are not mutually exclusive       | 3–7 options (instruction: "Select all that apply")|
| yes_no           | Simple binary questions                                             | Exactly ["Yes", "No"]                             |
| open_ended       | Collecting qualitative feedback or comments                         | Empty array []                                    |
| rating           | Numeric intensity or frequency on a wider scale                     | Exactly 10 options: "1" … "10"                    |

═══ BRANCHING / SKIP LOGIC ═══
Generate branching paths so that follow-up questions depend on previous answers.

Rules for branching:
1. Any question with type "yes_no", "multiple_choice", or "likert" can trigger a branch.
2. When a follow-up question should only appear for certain answers, set its "branchFrom" to the parent question's id and "branchCondition" to the triggering answer value(s).
3. "branchCondition" is an object with:
   - "questionId": the id of the parent question (same as "branchFrom").
   - "operator": one of "equals", "not_equals", "includes", "gte", "lte".
     • "equals" / "not_equals": the respondent's answer exactly matches (or doesn't match) one of the values.
     • "includes": for multi_select — the respondent selected at least one of the listed values.
     • "gte" / "lte": for likert or rating — the numeric answer is ≥ or ≤ the value.
   - "value": a single string OR an array of strings representing the triggering answer(s).
4. Questions with NO branch dependency must omit "branchFrom" and "branchCondition" (or set them to null).
5. Branching should feel natural — e.g., if someone answers "No" to a yes_no question, skip the detail question; if satisfaction is low (≤ 2), ask a follow-up "What could be improved?".
6. Keep branching shallow (max 2 levels deep) to avoid overly complex surveys.
7. At least 30% of questions should be unconditional (no branch) to ensure every respondent answers a core set.

═══ OUTPUT FORMAT ═══
Return ONLY valid JSON. No markdown fences, no explanation, no extra keys.
{
  "questions": [
    {
      "id": "q1",
      "text": "Question text here?",
      "type": "<one of the 6 types above>",
      "variable": "<exact variable name from the model>",
      "variableRole": "dependent" | "driver" | "control",
      "options": ["..."],
      "required": true,
      "branchFrom": null,
      "branchCondition": null
    },
    {
      "id": "q2",
      "text": "Follow-up only shown if q1 answered 'Yes'",
      "type": "open_ended",
      "variable": "...",
      "variableRole": "driver",
      "options": [],
      "required": false,
      "branchFrom": "q1",
      "branchCondition": {
        "questionId": "q1",
        "operator": "equals",
        "value": "Yes"
      }
    }
  ]
}

Rules for the output:
• "id" must be sequential: "q1", "q2", …
• "variable" must match a variable from the provided model EXACTLY.
• "variableRole" must be "dependent", "driver", or "control".
• "required" is true for all questions except open_ended, which should be false.
• Every variable in the model should have at least one corresponding question (within the max-questions budget).
• "branchFrom" is either null (unconditional) or the id of the parent question.
• "branchCondition" is either null or an object with "questionId", "operator", and "value".`;

export const QUESTION_GEN_USER_PROMPT_TEMPLATE = `Generate survey questions for the following survey and variable model.

═══ SURVEY CONFIGURATION ═══
- Title: {{title}}
- Goal: {{goal}}
- Population: {{population}}
- Confidence: {{confidence}}%
- Margin of error: ±{{margin}}%
- Language(s): {{language}}
- Tone: {{tone}}
- Maximum questions: {{maxQuestions}}

═══ VARIABLE MODEL ═══
Dependent variable(s): {{dependent}}
Driver variables: {{drivers}}
Control variables: {{controls}}

{{previousQuestionsSection}}

Generate up to {{maxQuestions}} questions following the system instructions. Return ONLY the JSON object.`;

export function buildQuestionGenUserPrompt(surveyDraft, variableModel, previousQuestions = null) {
  const {
    title = "",
    goal = "",
    population = "",
    confidence = "",
    margin = "",
    language = [],
    tone = "",
    maxQuestions = 10
  } = surveyDraft || {};

  const model = variableModel || {};
  const dependent = Array.isArray(model.dependent) ? model.dependent.join(", ") : "";
  const drivers = Array.isArray(model.drivers) ? model.drivers.join(", ") : "";
  const controls = Array.isArray(model.controls) ? model.controls.join(", ") : "";

  // Build previousQuestionsSection if questions exist
  let previousQuestionsSection = "";
  if (Array.isArray(previousQuestions) && previousQuestions.length > 0) {
    const previousTexts = previousQuestions.map(q => `- "${q.text}" (${q.type})`).join("\n");
    previousQuestionsSection = `═══ IMPORTANT: AVOID THESE PREVIOUS QUESTIONS ═══
Do NOT regenerate these exact questions. Generate completely different questions with different wording, structure, and approach while measuring the same variables:
${previousTexts}

When regenerating, use alternative phrasings, different question types where possible, and different approaches to measure the same constructs.

`;
  }

  return QUESTION_GEN_USER_PROMPT_TEMPLATE
    .replace("{{title}}", title)
    .replace("{{goal}}", goal)
    .replace("{{population}}", population)
    .replace("{{confidence}}", String(confidence))
    .replace("{{margin}}", String(margin))
    .replace("{{language}}", Array.isArray(language) ? language.join(" + ") : String(language))
    .replace("{{tone}}", tone)
    .replace(/\{\{maxQuestions\}\}/g, String(maxQuestions))
    .replace("{{dependent}}", dependent)
    .replace("{{drivers}}", drivers)
    .replace("{{controls}}", controls)
    .replace("{{previousQuestionsSection}}", previousQuestionsSection);
}

/* ------------------------------------------------------------------ */
/*  Chat System Prompt                                                */
/* ------------------------------------------------------------------ */

export const CHAT_SYSTEM_PROMPT_TEMPLATE = `You are a helpful survey methodology consultant and expert questionnaire designer. Your role is to assist users in creating high-quality surveys.

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
  const {
    surveyDraft = {},
    variableModel = {},
    currentStep = 1,
  } = context || {};

  const title = surveyDraft.title || "Untitled Survey";
  const goal = surveyDraft.goal || "Not specified";
  const population = surveyDraft.population || "Not specified";
  const dependent = Array.isArray(variableModel.dependent)
    ? variableModel.dependent.join(", ")
    : "Not specified";
  const drivers = Array.isArray(variableModel.drivers)
    ? variableModel.drivers.join(", ")
    : "Not specified";
  const controls = Array.isArray(variableModel.controls)
    ? variableModel.controls.join(", ")
    : "Not specified";

  return CHAT_SYSTEM_PROMPT_TEMPLATE
    .replace("{{surveyTitle}}", title)
    .replace("{{surveyGoal}}", goal)
    .replace("{{population}}", population)
    .replace("{{dependency}}", dependent)
    .replace("{{currentStep}}", String(currentStep))
    .replace("{{dependent}}", dependent)
    .replace("{{drivers}}", drivers)
    .replace("{{controls}}", controls);
}

export function buildAddQuestionsUserPrompt(surveyDraft, variableModel, existingQuestions, count) {
  const {
    title = "",
    goal = "",
    population = "",
    language = [],
    tone = "",
  } = surveyDraft || {};

  const model = variableModel || {};
  const dependent = Array.isArray(model.dependent) ? model.dependent.join(", ") : "";
  const drivers = Array.isArray(model.drivers) ? model.drivers.join(", ") : "";
  const controls = Array.isArray(model.controls) ? model.controls.join(", ") : "";

  const existingTexts =
    Array.isArray(existingQuestions) && existingQuestions.length > 0
      ? existingQuestions.map((q, i) => `- q${i + 1}: "${q.text}" (${q.type})`).join("\n")
      : "None";

  const nextId = (existingQuestions?.length || 0) + 1;

  return `Add exactly ${count} new survey question(s) to supplement the existing survey below.

═══ SURVEY CONFIGURATION ═══
- Title: ${title}
- Goal: ${goal}
- Population: ${population}
- Language(s): ${Array.isArray(language) ? language.join(" + ") : String(language)}
- Tone: ${tone}

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
        .filter((e) => e.hasIssues)
        .map((e) => `- Q${e.questionId}: ${e.issues.join(", ")}`)
        .join("\n")
    : "";

  return `User feedback for regeneration:
"${userFeedback}"

${
  issues
    ? `Current quality issues:\n${issues}\n\nPlease regenerate the questions addressing the user feedback above and resolving these quality issues.`
    : "Please regenerate the questions based on the user feedback above."
}`;
}

