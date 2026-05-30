import express from "express";
import { callGeminiForVariableModel, callGeminiForSurveyConfig } from "../services/gemini.js";
import { parsePdf } from "../services/pdfParser.js";
import { FALLBACK_VARIABLE_MODEL, HEALTHCARE_EXAMPLE_SURVEY } from "../data/demoData.js";

const router = express.Router();

router.post("/variable-model", async (req, res) => {
  const input = req.body || {};

  try {
    const model = await callGeminiForVariableModel(input);
    res.json({
      dependent: model.dependent,
      drivers: model.drivers,
      controls: model.controls
    });
  } catch (err) {
    console.error("Error in /api/variable-model:", err);
    res.status(500).json(FALLBACK_VARIABLE_MODEL);
  }
});

router.post("/extract-survey-config", async (req, res) => {
  const { content, isPdf } = req.body || {};

  try {
    let textContent = typeof content === "string" ? content : "";

    if (isPdf && textContent) {
      textContent = await parsePdf(textContent);
    }

    const config = await callGeminiForSurveyConfig(textContent);
    res.json(config);
  } catch (err) {
    console.error("Error in /api/extract-survey-config:", err);
    res.status(500).json(HEALTHCARE_EXAMPLE_SURVEY);
  }
});

export default router;
