import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";
import { useStepBase } from "../state/StepNavContext";

function Step2VariableModel() {
  const navigate = useNavigate();
  const location = useLocation();
  const stepBase = useStepBase();
  const { surveyDraft, variableModel, setVariableModelFromAI, isStepUnlocked } = useSurvey();
  const [localModel, setLocalModel] = useState({
    dependent: [],
    drivers: [],
    controls: []
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState("");

  const locked = !isStepUnlocked(2) || !surveyDraft.draftSaved;



  // Sync localModel from context whenever the model changes (e.g. navigating back)
  useEffect(() => {
    if (variableModel?.model) {
      setLocalModel({
        dependent: variableModel.model.dependent || [],
        drivers: variableModel.model.drivers || [],
        controls: variableModel.model.controls || [],
      });
    }
  }, [variableModel.model]);

  // Explicit trigger: fires when the user clicks "Next" in Step 1.
  // Uses location.state so it only runs once per navigation (state is cleared
  // on first use, preventing re-trigger on navigate-back).
  useEffect(() => {
    if (!location.state?.autoGenerate) return;
    if (locked) return;
    navigate(location.pathname, { replace: true, state: {} });
    handleGenerate();
  }, [locked]); // watch locked so it retries if state loads after mount

  // Fallback: auto-generate when there is no model and the step is unlocked
  // (handles direct navigation / page refresh without going through Step 1).
  useEffect(() => {
    if (variableModel?.model?.dependent?.length) return;
    if (locked) return;
    handleGenerate();
  }, [variableModel.model, locked]);


  function handleGenerate() {
    if (locked || loading || pendingRef.current) return;
    pendingRef.current = true;
    // Clear display immediately — stored/default values only appear after failure
    setLocalModel({ dependent: [], drivers: [], controls: [] });
    setLoading(true);
    setError("");

    fetch("/api/variable-model", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: surveyDraft.title,
        goal: surveyDraft.goal,
        population: surveyDraft.population,
        confidence: surveyDraft.confidence,
        margin: surveyDraft.margin,
        language: surveyDraft.language,
        tone: surveyDraft.tone,
        maxQuestions: surveyDraft.maxQuestions
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        const cleaned = {
          dependent: Array.isArray(data.dependent) ? data.dependent : [],
          drivers: Array.isArray(data.drivers) ? data.drivers : [],
          controls: Array.isArray(data.controls) ? data.controls : []
        };
        setVariableModelFromAI(cleaned);
        setLocalModel(cleaned);
      })
      .catch((err) => {
        console.error("Error generating variable model", err);
        // On failure, restore whatever was stored before generation started
        if (variableModel?.model) {
          setLocalModel({
            dependent: variableModel.model.dependent || [],
            drivers: variableModel.model.drivers || [],
            controls: variableModel.model.controls || [],
          });
        }
        setError("Failed to generate variable model from AI.");
      })
      .finally(() => {
        setLoading(false);
        pendingRef.current = false;
      });
  }

  function updateItem(section, index, value) {
    setLocalModel((prev) => {
      const arr = [...prev[section]];
      arr[index] = value;
      return { ...prev, [section]: arr };
    });
  }

  function addItem(section) {
    setLocalModel((prev) => {
      const arr = [...prev[section], ""];
      return { ...prev, [section]: arr };
    });
  }

  function removeItem(section, index) {
    setLocalModel((prev) => {
      const arr = prev[section].filter((_, idx) => idx !== index);
      return { ...prev, [section]: arr };
    });
  }

  const versionLabel = variableModel.status;

  const inputCls = "w-full rounded-lg border px-2.5 py-1.5 text-sm text-slate-800 outline-none transition-all duration-200 border-[#b0d4dc] bg-white focus:border-[#2AABBA] focus:ring-2 focus:ring-[#2AABBA]/20";

  const sections = [
    { key: "dependent", label: "Primary Outcome", sub: "Dependent Variable", dot: "#1B6B8A" },
    { key: "drivers",   label: "Drivers",         sub: "Independent Variables", dot: "#2AABBA" },
    { key: "controls",  label: "Controls",        sub: "Demographics", dot: "#5BBF8E" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>Variable Model</h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>AI-generated structure for your survey</p>
        </div>
        <span
          className="text-[11px] font-semibold px-3 py-1 rounded-full"
          style={{ backgroundColor: "#d0eaea", color: "#1B6B8A" }}
        >
          {versionLabel}
        </span>
      </div>

      {/* Lock warning */}
      {locked && (
        <div className="rounded-xl border px-4 py-3 text-sm font-medium" style={{ borderColor: "#f5c842", backgroundColor: "#fffbea", color: "#92700a" }}>
          ⚠ Step 2 is locked — save a survey draft in Step 1 first.
        </div>
      )}

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={locked || loading}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full text-white transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#1B6B8A" }}
          onMouseEnter={e => { if (!locked && !loading) e.currentTarget.style.backgroundColor = "#2AABBA"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}
        >
          {loading ? (
            <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Generating…</>
          ) : "Generate Variable Model (AI)"}
        </button>
      </div>

      {error && (
        <p className="text-sm font-medium text-red-500">⚠ {error}</p>
      )}

      {/* Variable sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map(({ key, label, sub, dot }) => (
          <div
            key={key}
            className="rounded-xl border p-4 space-y-3"
            style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#1B6B8A" }}>{label}</p>
                <p className="text-[10px]" style={{ color: "#9ab8c0" }}>{sub}</p>
              </div>
            </div>
            <ul className="space-y-2">
              {localModel[key].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateItem(key, idx, e.target.value)}
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(key, idx)}
                        className="text-xs text-red-400 hover:text-red-600 shrink-0"
                      >✕</button>
                    </>
                  ) : (
                    <span className="text-sm flex items-center gap-1.5" style={{ color: "#2d6a80" }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: dot }} />
                      {item}
                    </span>
                  )}
                </li>
              ))}
              {localModel[key].length === 0 && !isEditing && (
                <li className="text-xs italic" style={{ color: "#9ab8c0" }}>No items yet</li>
              )}
              {isEditing && (
                <li>
                  <button
                    type="button"
                    onClick={() => addItem(key)}
                    className="text-xs font-semibold"
                    style={{ color: "#2AABBA" }}
                  >+ Add item</button>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          disabled={locked}
          className="text-sm font-semibold px-4 py-2.5 rounded-full border transition-colors duration-200 disabled:opacity-40"
          style={{ borderColor: "#2AABBA", color: "#1B6B8A" }}
          onMouseEnter={e => { if (!locked) e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          {isEditing ? "Done Editing" : "Edit"}
        </button>
        <button
          type="button"
          onClick={() => navigate(`${stepBase}/3-questions`, { state: { autoGenerate: true } })}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full text-white shadow-md transition-colors duration-200"
          style={{ backgroundColor: "#1B6B8A" }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#2AABBA"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}
        >
          Next: Generate Questions
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default Step2VariableModel;