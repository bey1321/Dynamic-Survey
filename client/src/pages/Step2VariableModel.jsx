import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";

function Step2VariableModel() {
  const navigate = useNavigate();
  const { surveyDraft, variableModel, setVariableModelFromAI, approveVariableModel, isStepUnlocked } = useSurvey();
  const [localModel, setLocalModel] = useState({
    dependent: [],
    drivers: [],
    controls: []
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const locked = !isStepUnlocked(2) || !surveyDraft.draftSaved;

  useEffect(() => {
    setLocalModel({
      dependent: [],
      drivers: [],
      controls: []
    });
  }, []);

  function handleGenerate() {
    if (locked) return;
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
        setError("Failed to generate variable model from AI.");
      })
      .finally(() => {
        setLoading(false);
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

  function handleApprove() {
    const cleaned = {
      dependent: localModel.dependent.map((s) => s.trim()).filter(Boolean),
      drivers: localModel.drivers.map((s) => s.trim()).filter(Boolean),
      controls: localModel.controls.map((s) => s.trim()).filter(Boolean)
    };
    approveVariableModel(cleaned);
  }

  const versionLabel =
    variableModel.approvedVersion > 0
      ? `Variable Model Approved (v${variableModel.approvedVersion})`
      : variableModel.status;

  return (
    <div className="space-y-5">
      <div className="mono-block inline-block mb-2">[Variable Model]</div>

      {locked && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Step 2 is locked until a survey draft is saved in Step 1.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={locked || loading}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded bg-primary text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {loading ? "Generating Variable Model (AI)..." : "Generate Variable Model (AI)"}
        </button>
        <span className="text-xs text-slate-600">{versionLabel}</span>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">
            Primary Outcome (Dependent Variable)
          </div>
          <ul className="space-y-2 text-sm text-slate-800">
            {localModel.dependent.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="text-slate-500">-</span>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateItem("dependent", idx, e.target.value)}
                      className="mono-block flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem("dependent", idx)}
                      className="text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <span>{item}</span>
                )}
              </li>
            ))}
            {isEditing && (
              <li>
                <button
                  type="button"
                  onClick={() => addItem("dependent")}
                  className="text-xs text-primary"
                >
                  + Add dependent variable
                </button>
              </li>
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">
            Drivers (Independent Variables)
          </div>
          <ul className="space-y-2 text-sm text-slate-800">
            {localModel.drivers.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="text-slate-500">-</span>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateItem("drivers", idx, e.target.value)}
                      className="mono-block flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem("drivers", idx)}
                      className="text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <span>{item}</span>
                )}
              </li>
            ))}
            {isEditing && (
              <li>
                <button
                  type="button"
                  onClick={() => addItem("drivers")}
                  className="text-xs text-primary"
                >
                  + Add driver
                </button>
              </li>
            )}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">Controls (Demographics)</div>
          <ul className="space-y-2 text-sm text-slate-800">
            {localModel.controls.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="text-slate-500">-</span>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateItem("controls", idx, e.target.value)}
                      className="mono-block flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem("controls", idx)}
                      className="text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <span>{item}</span>
                )}
              </li>
            ))}
            {isEditing && (
              <li>
                <button
                  type="button"
                  onClick={() => addItem("controls")}
                  className="text-xs text-primary"
                >
                  + Add control
                </button>
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={locked}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded bg-emerald-600 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          disabled={locked}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded border border-slate-300 text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {isEditing ? "Done" : "Edit"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/step/3-questions")}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded bg-primary text-white"
        >
          Next: Generate Questions
        </button>
      </div>
    </div>
  );
}

export default Step2VariableModel;

