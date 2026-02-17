import React from "react";
import { useToast } from "../state/ToastContext";

function Step5Simulation() {
  const { showToast } = useToast();

  function handleClick() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  return (
    <div className="space-y-4">
      <div className="mono-block inline-block mb-2">[Simulation (Stress Test + Branching)]</div>
      <div className="space-y-1 text-sm text-slate-800">
        <div>Simulated respondent paths across branching logic.</div>
        <div>Identified potential drop-off points and time-to-complete distribution.</div>
        <div>Branching logic added (v2)</div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-primary text-white"
      >
        Run Simulation
      </button>
    </div>
  );
}

export default Step5Simulation;

