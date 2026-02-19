export const QUALITY_THRESHOLDS = {
  // Minimum LLM evaluation score (clarity, neutrality, answerability, relevance)
  minLLM: 4,
  // Minimum similarity between question and its assigned variable
  minVariableRelevance: 0.3,
  // Maximum allowed duplicate similarity
  maxDuplicate: 0.85
};