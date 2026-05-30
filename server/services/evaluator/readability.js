function countSyllables(word) {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function fleschReadingEase(text) {
  const sentences = Math.max(1, text.split(/[.!?]/).filter(Boolean).length);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const syllables = words.reduce((s, w) => s + countSyllables(w), 0);

  const W = words.length || 1;
  const S = sentences;
  const SY = syllables;

  return 206.835 - 1.015 * (W / S) - 84.6 * (SY / W);
}

export function readabilityScore(questionText) {
  const score = fleschReadingEase(questionText);
  return parseFloat(Math.min(100, Math.max(0, score)).toFixed(2));
}
