export const QUALITY_THRESHOLDS = {
  minLLMAverage: 3.0,              // average of all 4 LLM dimensions must be >= 3.0
  minLLMCritical: 2,               // any single LLM score below this always triggers regen
  minVariableRelevance: 0.3,
  minVariableRelevanceControl: 0.2,
  maxDuplicate: 0.90,
  minReadability: 20,              // Flesch score (0-100); below 20 = extremely hard to read
  maxFailRatio: 0.40,              // only regenerate when > 40% of questions have quality issues
};
