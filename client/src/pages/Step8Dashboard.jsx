import React from "react";
import { useToast } from "../state/ToastContext";

function Step8Dashboard() {
  const { showToast } = useToast();

  function handleClick() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  const metrics = [
    { label: "Total Responses", value: "412", sub: "collected", accent: "#1B6B8A" },
    { label: "Avg. Satisfaction", value: "3.1", sub: "out of 5", accent: "#2AABBA" },
    { label: "Top Dissatisfaction Driver", value: "Waiting Time", sub: "most cited", accent: "#5BBF8E" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>Dashboard</h2>
        <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>Survey response analytics overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map(({ label, value, sub, accent }) => (
          <div
            key={label}
            className="rounded-xl border p-5 space-y-1"
            style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd", borderLeft: `4px solid ${accent}` }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#9ab8c0" }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
            <p className="text-xs" style={{ color: "#9ab8c0" }}>{sub}</p>
          </div>
        ))}
      </div>

      <button type="button" onClick={handleClick}
        className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full text-white transition-colors duration-200"
        style={{ backgroundColor: "#1B6B8A" }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#2AABBA"; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}>
        Export Dashboard Data
      </button>
    </div>
  );
}

export default Step8Dashboard;

