import { getEmbedder, cosineSimilarity } from "./embedder.js";

function buildVariablePrompt(variableName, variableRole) {
  if (variableRole === "control") {
    return `This is a demographic or background question collecting information about: ${variableName}.`;
  }
  if (variableRole === "driver") {
    return `This question measures a factor that influences the outcome: ${variableName}.`;
  }
  if (variableRole === "dependent") {
    return `This question measures the primary outcome variable: ${variableName}.`;
  }
  return `This question measures the variable: ${variableName}.`;
}

export async function variableRelevanceScore(questionText, assignedVariable, variableRole) {
  if (!assignedVariable) return 1.0;

  const model = await getEmbedder();
  if (!model) return 1.0;

  try {
    const qOut = await model(questionText, { pooling: "mean", normalize: true });
    const qEmb = Array.from(qOut.data);

    const prompt = buildVariablePrompt(assignedVariable, variableRole);
    const vOut = await model(prompt, { pooling: "mean", normalize: true });
    const vEmb = Array.from(vOut.data);

    return parseFloat(cosineSimilarity(qEmb, vEmb).toFixed(4));
  } catch {
    return 1.0;
  }
}
