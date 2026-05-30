import { fillTemplate } from "./utils.js";

export const SURVEY_CONFIG_SYSTEM_PROMPT = `You are an expert survey methodologist and government statistics analyst.
Return ONLY valid JSON. No markdown. No explanation.`;

const USER_PROMPT_TEMPLATE = `Given the following survey specification text, extract the core survey configuration fields.

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
  return fillTemplate(USER_PROMPT_TEMPLATE, { text: text ?? "" });
}
