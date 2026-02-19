import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";
import { useStepBase } from "../state/StepNavContext";

function Step1CreateSurvey() {
  const navigate = useNavigate();
  const stepBase = useStepBase();
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
    navigate(`${stepBase}/2-variables`);
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

/* ── shared input style ── */
  const inputCls = [
    "w-full rounded-lg border px-3 py-2 text-sm text-slate-800 outline-none transition-all duration-200",
    "border-[#b0d4dc] bg-white",
    "focus:border-[#2AABBA] focus:ring-2 focus:ring-[#2AABBA]/20",
    "placeholder:text-slate-400",
  ].join(" ");

  const labelCls = "block text-xs font-semibold uppercase tracking-wide mb-1" ;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>
            Create New Survey
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>
            Fill in the basic details to get started
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadExample}
          className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200"
          style={{ borderColor: "#2AABBA", color: "#1B6B8A" }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          Load Healthcare Example
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Section 1 – Core details */}
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#2AABBA" }}>
            Survey Details
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>Survey Title</label>
              <input
                type="text"
                name="title"
                value={form.title || ""}
                onChange={handleChange}
                className={inputCls}
                placeholder="e.g. Healthcare Satisfaction – RAK"
              />
            </div>

            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>Target Population</label>
              <input
                type="text"
                name="population"
                value={form.population || ""}
                onChange={handleChange}
                className={inputCls}
                placeholder="e.g. RAK Residents (18+)"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls} style={{ color: "#1B6B8A" }}>Survey Goal</label>
              <input
                type="text"
                name="goal"
                value={form.goal || ""}
                onChange={handleChange}
                className={inputCls}
                placeholder="e.g. Identify key drivers of dissatisfaction"
              />
            </div>
          </div>
        </div>

        {/* Section 2 – Statistical settings */}
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#2AABBA" }}>
            Statistical Settings
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>Confidence</label>
              <select name="confidence" value={form.confidence} onChange={handleChange} className={inputCls}>
                <option value="90">90%</option>
                <option value="95">95%</option>
                <option value="99">99%</option>
              </select>
            </div>

            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>Margin of Error</label>
              <select name="margin" value={form.margin} onChange={handleChange} className={inputCls}>
                <option value="3">±3%</option>
                <option value="5">±5%</option>
                <option value="7">±7%</option>
              </select>
            </div>

            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>Tone</label>
              <select name="tone" value={form.tone} onChange={handleChange} className={inputCls}>
                <option value="Neutral / Government">Neutral / Govt</option>
                <option value="Friendly">Friendly</option>
                <option value="Formal">Formal</option>
              </select>
            </div>

            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>Max Questions</label>
              <input
                type="number"
                name="maxQuestions"
                value={form.maxQuestions}
                onChange={handleChange}
                className={inputCls}
                min={1}
              />
            </div>
          </div>

          {/* Language checkboxes */}
          <div>
            <label className={labelCls} style={{ color: "#1B6B8A" }}>Language</label>
            <div className="flex items-center gap-4 mt-1">
              {["English", "Arabic"].map((lang) => (
                <label
                  key={lang}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      name="language"
                      value={lang}
                      checked={form.language.includes(lang)}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center border-2 transition-colors duration-200"
                      style={{
                        borderColor: form.language.includes(lang) ? "#1B6B8A" : "#b0d4dc",
                        backgroundColor: form.language.includes(lang) ? "#1B6B8A" : "white",
                      }}
                    >
                      {form.language.includes(lang) && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm" style={{ color: "#1B6B8A" }}>{lang}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3 – File upload */}
        <div
          className="rounded-xl border p-5 space-y-3"
          style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#2AABBA" }}>
            Import from File (optional)
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className="flex items-center gap-2 cursor-pointer text-sm px-4 py-2 rounded-lg border transition-colors duration-200"
              style={{ borderColor: "#b0d4dc", color: "#1B6B8A" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {uploadFile ? uploadFile.name : "Choose file"}
              <input type="file" onChange={handleFileChange} className="sr-only" />
            </label>
            <button
              type="button"
              onClick={handleExtractFromFile}
              disabled={extracting}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-colors duration-200 disabled:opacity-50"
              style={{ backgroundColor: "#2AABBA" }}
            >
              {extracting ? "Extracting…" : "Extract Details"}
            </button>
          </div>
          {extractError && (
            <p className="text-xs font-medium text-red-500 flex items-center gap-1">
              <span>⚠</span> {extractError}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm font-medium text-red-500 flex items-center gap-1">
            <span>⚠</span> {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full text-white shadow-md transition-colors duration-200"
            style={{ backgroundColor: "#1B6B8A" }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#2AABBA"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}
          >
                        Next
          </button>
        </div>
      </form>

      {/* Saved confirmation */}
      {saved && (
        <div
          className="rounded-xl border p-4 space-y-1.5"
          style={{ borderColor: "#5BBF8E", backgroundColor: "#f0faf5" }}
        >
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#2d8c5e" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Draft saved successfully
          </p>
          <p className="text-xs" style={{ color: "#5a8a6a" }}>
            Estimated sample size: ~385 (95% confidence, ±5% margin)
          </p>
          <p className="text-xs" style={{ color: "#5a8a6a" }}>
            Estimated completion time: 3–4 minutes
          </p>
        </div>
      )}
    </div>
  );
}

export default Step1CreateSurvey;

