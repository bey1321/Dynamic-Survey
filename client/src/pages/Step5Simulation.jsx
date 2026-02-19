import React from "react";
import { useToast } from "../state/ToastContext";

function Step5Simulation() {
  const { showToast } = useToast();

  function handleClick() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>Simulation</h2>
        <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>Stress test and branching logic analysis</p>
      </div>

      <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}>
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#2AABBA" }}>Simulation Results</p>

        {[
          { icon: "→", text: "Simulated respondent paths across branching logic" },
          { icon: "→", text: "Identified potential drop-off points and time-to-complete distribution" },
          { icon: "→", text: "Branching logic validated (v2)" },
        ].map(({ icon, text }, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: "#e8f6f7" }}>
            <span className="font-bold mt-0.5 shrink-0" style={{ color: "#2AABBA" }}>{icon}</span>
            <span className="text-sm" style={{ color: "#2d6a80" }}>{text}</span>
          </div>
        ))}
      </div>

      <button type="button" onClick={handleClick}
        className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full text-white transition-colors duration-200"
        style={{ backgroundColor: "#1B6B8A" }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#2AABBA"; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}>
        Run Simulation
      </button>
    </div>
  );
}

export default Step5Simulation;

