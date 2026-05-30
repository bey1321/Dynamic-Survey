const NEG_WORDS = new Set(["not", "never", "no", "none", "hardly", "rarely", "neither", "nor"]);
const VAGUE_TERMS = ["a lot", "many", "some"];
const LEADING_PHRASES = [
  "would you agree",
  "would you say",
  "don't you think",
  "surely",
  "obviously",
  "naturally",
  "it's clear that",
  "as everyone knows",
  "most people",
  "everyone agrees",
];

export function ruleViolations(questionText) {
  const v = [];
  const text = questionText.toLowerCase();
  const words = text.split(/\s+/);

  if ((questionText.match(/\?/g) || []).length > 1) v.push("multiple_questions");
  if (words.length > 40) v.push("too_long");

  const andCount = (text.match(/\band\b/g) || []).length;
  if (words.length > 10 && andCount >= 2) v.push("double_barreled");

  outer: for (let i = 0; i < words.length; i++) {
    if (NEG_WORDS.has(words[i])) {
      for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
        if (NEG_WORDS.has(words[j].replace(/[^a-z]/g, ""))) {
          v.push("double_negative");
          break outer;
        }
      }
    }
  }

  if (VAGUE_TERMS.some(w => text.includes(w))) v.push("vague_language");
  if (LEADING_PHRASES.some(p => text.includes(p))) v.push("leading_language");

  return v;
}
