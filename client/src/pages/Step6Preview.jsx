import React from "react";
import { useToast } from "../state/ToastContext";

function Step6Preview() {
  const { showToast } = useToast();

  function handleClick() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  return (
    <div className="space-y-4">
      <div className="mono-block inline-block mb-2">[Final Survey Preview + Export]</div>

      <div className="space-y-2 text-sm text-slate-800">
        <div>Full question flow preview with branching.</div>
        <div>Export formats: JSON / CSV / Survey platform configuration.</div>
      </div>

      <div className="mono-block mt-2 text-xs overflow-x-auto">
        <div>{"{"}</div>
        <div className="pl-4">"surveyId": "healthcare-satisfaction-rak-v1",</div>
        <div className="pl-4">"title": "Healthcare Satisfaction - RAK",</div>
        <div className="pl-4">"questions": [</div>
        <div className="pl-8">"Q1. Overall satisfaction (1–5)",</div>
        <div className="pl-8">"Q2. Waiting time",</div>
        <div className="pl-8">"... (rest of questions exactly as in the specification document)"</div>
        <div className="pl-4">]</div>
        <div>{"}"}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-primary text-white"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-slate-800 text-white"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}

export default Step6Preview;

