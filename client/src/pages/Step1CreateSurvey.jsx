import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";
import { useStepBase } from "../state/StepNavContext";
import { useTranslation } from "react-i18next";

function Step1CreateSurvey() {
  const navigate = useNavigate();
  const location = useLocation();
  const stepBase = useStepBase();
  const { surveyDraft, saveSurveyDraft, loadHealthcareExample } = useSurvey();
  const { t } = useTranslation(["common", "survey"]);
  const mode = location.state?.mode || "ai";
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
      const next = hasLang
        ? form.language.filter((l) => l !== lang)
        : [...form.language, lang];
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
      setError(t("survey:fillRequiredFields"));
      return;
    }
    setError("");
    saveSurveyDraft(form, mode);
    setSaved(true);
    navigate(`${stepBase}/2-variables`, { state: { autoGenerate: true } });
  }

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setUploadFile(file);
    setExtractError("");
  }

  function handleExtractFromFile() {
    if (!uploadFile) {
      setExtractError(t("survey:chooseFileFirst"));
      return;
    }
    setExtractError("");
    setExtracting(true);

    const isPdf =
      uploadFile.type === "application/pdf" ||
      uploadFile.name.toLowerCase().endsWith(".pdf");
    const reader = new FileReader();
    reader.onload = function () {
      let content = "";
      let isPdfFlag = false;
      if (isPdf) {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        content = dataUrl.split(",")[1] || "";
        isPdfFlag = true;
      } else {
        content = typeof reader.result === "string" ? reader.result : "";
      }
      fetch("/api/extract-survey-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, isPdf: isPdfFlag }),
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
            language:
              Array.isArray(data.language) && data.language.length > 0
                ? data.language
                : prev.language,
            tone: data.tone || prev.tone,
            maxQuestions:
              typeof data.maxQuestions === "number" &&
              Number.isFinite(data.maxQuestions)
                ? data.maxQuestions
                : prev.maxQuestions,
          }));
        })
        .catch(() => {
          setExtractError(t("survey:extractFailed"));
        })
        .finally(() => {
          setExtracting(false);
        });
    };
    reader.onerror = function () {
      setExtractError(t("survey:readFileFailed"));
      setExtracting(false);
    };

    if (isPdf) {
      reader.readAsDataURL(uploadFile);
    } else {
      reader.readAsText(uploadFile);
    }
  }

  /* ── shared input style ── */
  const inputCls = [
    "w-full rounded-lg border px-3 py-2 text-sm text-slate-800 outline-none transition-all duration-200",
    "border-[#b0d4dc] bg-white",
    "focus:border-[#2AABBA] focus:ring-2 focus:ring-[#2AABBA]/20",
    "placeholder:text-slate-400",
  ].join(" ");

  const labelCls = "block text-xs font-semibold uppercase tracking-wide mb-1";

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>
            {t("survey:createNewSurvey")}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>
            {t("survey:fillBasicDetails")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadExample}
          className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors duration-200"
          style={{ borderColor: "#2AABBA", color: "#1B6B8A" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#e8f6f7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {t("survey:loadHealthcareExample")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1 – Core details */}
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#2AABBA" }}
          >
            {t("survey:surveyDetails")}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>
                {t("survey:surveyTitle")}
              </label>
              <input
                type="text"
                name="title"
                value={form.title || ""}
                onChange={handleChange}
                className={inputCls}
                placeholder={t("survey:surveyTitlePlaceholder")}
              />
            </div>

            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>
                {t("survey:targetPopulation")}
              </label>
              <input
                type="text"
                name="population"
                value={form.population || ""}
                onChange={handleChange}
                className={inputCls}
                placeholder={t("survey:targetPopulationPlaceholder")}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls} style={{ color: "#1B6B8A" }}>
                {t("survey:surveyGoal")}
              </label>
              <textarea
                name="goal"
                value={form.goal || ""}
                onChange={handleChange}
                className={inputCls}
                placeholder={t("survey:surveyGoalPlaceholder")}
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Section 2 – Statistical settings */}
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#2AABBA" }}
          >
            {t("survey:statisticalSettings")}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>{t("survey:confidenceLevel")}</label>
              <select name="confidence" value={form.confidence} onChange={handleChange} className={inputCls}>
                <option value="90">90%</option>
                <option value="95">95%</option>
                <option value="99">99%</option>
              </select>
            </div>

            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>{t("survey:marginOfError")}</label>
              <select name="margin" value={form.margin} onChange={handleChange} className={inputCls}>
                <option value="3">±3%</option>
                <option value="5">±5%</option>
                <option value="7">±7%</option>
              </select>
            </div> */}

            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>
                {t("survey:tone")}
              </label>
              <select
                name="tone"
                value={form.tone}
                onChange={handleChange}
                className={inputCls}
              >
                <option value="Neutral / Government">
                  {t("survey:toneNeutralGovt")}
                </option>
                <option value="Friendly">{t("survey:toneFriendly")}</option>
                <option value="Formal">{t("survey:toneFormal")}</option>
              </select>
            </div>

            <div>
              <label className={labelCls} style={{ color: "#1B6B8A" }}>
                {t("survey:maxQuestions")}
              </label>
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
            <label className={labelCls} style={{ color: "#1B6B8A" }}>
              {t("common:language")}
            </label>
            <div className="flex items-center gap-4 mt-1">
              {[
                { value: "English", label: t("common:english") },
                { value: "Arabic", label: t("common:arabic") },
              ].map((lang) => (
                <label
                  key={lang.value}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      name="language"
                      value={lang.value}
                      checked={form.language.includes(lang.value)}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center border-2 transition-colors duration-200"
                      style={{
                        borderColor: form.language.includes(lang.value)
                          ? "#1B6B8A"
                          : "#b0d4dc",
                        backgroundColor: form.language.includes(lang.value)
                          ? "#1B6B8A"
                          : "white",
                      }}
                    >
                      {form.language.includes(lang.value) && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M1.5 5L4 7.5L8.5 2.5"
                            stroke="white"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm" style={{ color: "#1B6B8A" }}>
                    {lang.label}
                  </span>
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
          <p
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#2AABBA" }}
          >
            {t("survey:importFromFile")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className="flex items-center gap-2 cursor-pointer text-sm px-4 py-2 rounded-lg border transition-colors duration-200"
              style={{ borderColor: "#b0d4dc", color: "#1B6B8A" }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {uploadFile ? uploadFile.name : t("survey:chooseFile")}
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            <button
              type="button"
              onClick={handleExtractFromFile}
              disabled={extracting}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-colors duration-200 disabled:opacity-50"
              style={{ backgroundColor: "#2AABBA" }}
            >
              {extracting ? t("survey:extracting") : t("survey:extractDetails")}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#2AABBA";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#1B6B8A";
            }}
          >
            {t("common:next")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Step1CreateSurvey;