import { getEmbedder, cosineSimilarity } from "./embedder.js";

export async function duplicateScores(questionTexts) {
  const model = await getEmbedder();

  if (!model) {
    return questionTexts.map((_, i) =>
      questionTexts.map((_, j) => (i === j ? 1 : 0))
    );
  }

  try {
    const embs = [];
    for (const q of questionTexts) {
      const out = await model(q, { pooling: "mean", normalize: true });
      embs.push(Array.from(out.data));
    }

    const matrix = [];
    for (let i = 0; i < embs.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < embs.length; j++) {
        matrix[i][j] = cosineSimilarity(embs[i], embs[j]);
      }
    }
    return matrix;
  } catch {
    return questionTexts.map((_, i) =>
      questionTexts.map((_, j) => (i === j ? 1 : 0))
    );
  }
}
