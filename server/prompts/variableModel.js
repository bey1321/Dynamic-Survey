import { getLangStr, fillTemplate } from "./utils.js";

const BASE_SYSTEM_PROMPT = `You are an expert survey methodologist and government statistics analyst.
Return ONLY valid JSON. No markdown. No explanation.`;

const USER_PROMPT_TEMPLATE = `Generate a survey Variable Model (measurement model) for the following official survey.
Context:
- Title: {{title}}
- Goal: {{goal}}
- Population: {{population}}
- Confidence: {{confidence}}%
- Margin: ±{{margin}}%
- Language: {{language}}
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
- Keep each item short (2–6 words).
{{langRule}}`;

export function buildVariableModelSystemPrompt(language) {
  const langStr = getLangStr(language);
  const langInstruction = langStr === "Arabic"
    ? " Generate all text in Arabic (العربية) only."
    : "";
  return `You are an expert survey methodologist and government statistics analyst.${langInstruction}
Return ONLY valid JSON. No markdown. No explanation.`;
}

export function buildVariableModelUserPrompt(input) {
  const {
    title = "", goal = "", population = "",
    confidence = "", margin = "", language = "",
    tone = "", maxQuestions = "",
  } = input || {};

  const langStr = getLangStr(language);
  const langRule = langStr === "Arabic"
    ? "- CRITICAL: ALL variable names and labels MUST be written entirely in Arabic (العربية). Do not use any English words."
    : "";

  return fillTemplate(USER_PROMPT_TEMPLATE, {
    title, goal, population, confidence, margin,
    language: langStr, tone, maxQuestions, langRule,
  });
}
