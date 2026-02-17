import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";

function Step1CreateSurvey() {
  const navigate = useNavigate();
  const { surveyDraft, saveSurveyDraft, loadHealthcareExample } = useSurvey();
  const [form, setForm] = useState(surveyDraft);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(surveyDraft.draftSaved);
  const [uploadFile, setUploadFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  useEffect(() => {
    setForm(surveyDraft);
    setSaved(surveyDraft.draftSaved);
  }, [surveyDraft]);

  function handleChange(e) {
    const { name, value, type } = e.target;
    if (name === "language") {
      const lang = value;
      const hasLang = form.language.includes(lang);
      const next = hasLang ? form.language.filter((l) => l !== lang) : [...form.language, lang];
      setForm((prev) => ({ ...prev, language: next }));
      return;
    }
    if (name === "maxQuestions") {
      const numeric = type === "number" ? Number(value) || 0 : value;
      setForm((prev) => ({ ...prev, [name]: numeric }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleLoadExample() {
    loadHealthcareExample();
    setError("");
    setSaved(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.goal || !form.population) {
      setError("Please fill in Title, Goal, and Population.");
      return;
    }
    setError("");
    saveSurveyDraft(form);
    setSaved(true);
    navigate("/step/2-variables");
  }

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setUploadFile(file);
    setExtractError("");
  }

  function handleExtractFromFile() {
    if (!uploadFile) {
      setExtractError("Please choose a file to upload.");
      return;
    }
    setExtractError("");
    setExtracting(true);

    const reader = new FileReader();
    reader.onload = function () {
      const content = typeof reader.result === "string" ? reader.result : "";
      fetch("/api/extract-survey-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content })
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("Extraction request failed");
          }
          return res.json();
        })
        .then((data) => {
          setForm((prev) => ({
            ...prev,
            title: data.title || prev.title,
            goal: data.goal || prev.goal,
            population: data.population || prev.population,
            confidence: data.confidence || prev.confidence,
            margin: data.margin || prev.margin,
            language: Array.isArray(data.language) && data.language.length > 0 ? data.language : prev.language,
            tone: data.tone || prev.tone,
            maxQuestions:
              typeof data.maxQuestions === "number" && Number.isFinite(data.maxQuestions)
                ? data.maxQuestions
                : prev.maxQuestions
          }));
        })
        .catch(() => {
          setExtractError("Failed to extract survey details from file.");
        })
        .finally(() => {
          setExtracting(false);
        });
    };
    reader.onerror = function () {
      setExtractError("Unable to read the selected file.");
      setExtracting(false);
    };

    reader.readAsText(uploadFile);
  }

  const isEnglishSelected = form.language.includes("English");
  const isArabicSelected = form.language.includes("Arabic");

  return (
    <div className="space-y-6">
      <div className="mono-block inline-block mb-2">[Create New Survey]</div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <label className="w-28 text-sm font-medium text-slate-700">Title:</label>
            <input
              type="text"
              name="title"
              value={form.title || ""}
              onChange={handleChange}
              className="flex-1 mono-block"
              placeholder="Healthcare Satisfaction - RAK"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-28 text-sm font-medium text-slate-700">Goal:</label>
            <input
              type="text"
              name="goal"
              value={form.goal || ""}
              onChange={handleChange}
              className="flex-1 mono-block"
              placeholder="Identify drivers of dissatisfaction"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-28 text-sm font-medium text-slate-700">Population:</label>
            <input
              type="text"
              name="population"
              value={form.population || ""}
              onChange={handleChange}
              className="flex-1 mono-block"
              placeholder="RAK Residents (18+)"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-24 text-sm font-medium text-slate-700">Confidence:</label>
            <select
              name="confidence"
              value={form.confidence}
              onChange={handleChange}
              className="mono-block flex-1"
            >
              <option value="90">90%</option>
              <option value="95">95%</option>
              <option value="99">99%</option>
            </select>
            <span className="w-16 text-sm font-medium text-slate-700 text-right">Margin:</span>
            <select
              name="margin"
              value={form.margin}
              onChange={handleChange}
              className="mono-block flex-1"
            >
              <option value="3">±3%</option>
              <option value="5">±5%</option>
              <option value="7">±7%</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="w-28 text-sm font-medium text-slate-700">Language:</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="language"
                  value="English"
                  checked={isEnglishSelected}
                  onChange={handleChange}
                />
                <span>English</span>
              </label>
              <label className="inline-flex items-center gap-1 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="language"
                  value="Arabic"
                  checked={isArabicSelected}
                  onChange={handleChange}
                />
                <span>Arabic</span>
              </label>
            </div>
            <div className="flex-1" />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-24 text-sm font-medium text-slate-700">Tone:</label>
            <select
              name="tone"
              value={form.tone}
              onChange={handleChange}
              className="mono-block flex-1"
            >
              <option value="Neutral / Government">Neutral / Government</option>
              <option value="Friendly">Friendly</option>
              <option value="Formal">Formal</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="w-32 text-sm font-medium text-slate-700">Max Questions:</label>
            <input
              type="number"
              name="maxQuestions"
              value={form.maxQuestions}
              onChange={handleChange}
              className="mono-block w-24"
              min={1}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-800">Extract from file upload</div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              onChange={handleFileChange}
              className="text-sm"
            />
            <button
              type="button"
              onClick={handleExtractFromFile}
              disabled={extracting}
              className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-slate-800 text-white disabled:bg-slate-400"
            >
              {extracting ? "Extracting..." : "Extract from file upload"}
            </button>
          </div>
          {extractError && <p className="text-sm text-red-600">{extractError}</p>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded bg-primary text-white hover:bg-blue-600"
          >
            Next: Build Variable Model
          </button>
          <button
            type="button"
            onClick={handleLoadExample}
            className="inline-flex items-center px-3 py-2 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Load Healthcare Example (RAK)
          </button>
        </div>
      </form>

      {saved && (
        <div className="mt-4 mono-block space-y-1">
          <div>✅ Draft saved</div>
          <div>Estimated minimum sample size: ~385 (for 95%, ±5%)</div>
          <div>Estimated completion time: 3–4 minutes (20 seconds per question, range ok)</div>
        </div>
      )}
    </div>
  );
}

export default Step1CreateSurvey;

