import React from "react";
import { useToast } from "../state/ToastContext";

function Step4Audit() {
  const { showToast } = useToast();

  function handleClick() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>Quality Check</h2>
        <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>Bias detection and validity analysis</p>
      </div>

      <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}>
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#2AABBA" }}>Results</p>

        <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: "#f0faf5", borderLeft: "3px solid #5BBF8E" }}>
          <span style={{ color: "#5BBF8E" }}>✓</span>
          <span className="text-sm" style={{ color: "#2d6a80" }}>Neutral wording: OK</span>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: "#fffbea", borderLeft: "3px solid #f5c842" }}>
          <span style={{ color: "#92700a" }}>⚠</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "#92700a" }}>Clarity issue: Q4 timeframe unclear</p>
            <p className="text-xs mt-0.5" style={{ color: "#9ab8c0" }}>"improve" could mean any time period</p>
            <p className="text-xs mt-1 font-medium" style={{ color: "#2d6a80" }}>Suggested fix: Specify a clear timeframe (e.g., "in the past 12 months")</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "#e8f6f7" }}>
          <span className="text-sm font-semibold" style={{ color: "#1B6B8A" }}>Quality Score</span>
          <span className="text-2xl font-bold" style={{ color: "#1B6B8A" }}>92<span className="text-sm font-normal">/100</span></span>
        </div>
      </div>

      <button type="button" onClick={handleClick}
        className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full text-white transition-colors duration-200"
        style={{ backgroundColor: "#1B6B8A" }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#2AABBA"; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}>
        Re-run Quality Check
      </button>
    </div>
  );
}

export default Step4Audit;

