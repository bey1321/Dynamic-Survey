import React from "react";
import { useToast } from "../state/ToastContext";

function Step4Audit() {
  const { showToast } = useToast();

  function handleClick() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  return (
    <div className="space-y-4">
      <div className="mono-block inline-block mb-2">[Quality Check (Bias + Validity)]</div>
      <div className="space-y-1 text-sm text-slate-800">
        <div>✅ Neutral wording: OK</div>
        <div>⚠️ Clarity issue: Q4 timeframe unclear ("improve" could mean any time)</div>
        <div>Suggested fix: Specify a clear timeframe (e.g., "in the past 12 months").</div>
        <div>Quality Score: 92/100</div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-primary text-white"
      >
        Re-run Quality Check
      </button>
    </div>
  );
}

export default Step4Audit;

