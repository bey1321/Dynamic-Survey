import React from "react";
import { useToast } from "../state/ToastContext";

function Step8Dashboard() {
  const { showToast } = useToast();

  function handleClick() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  return (
    <div className="space-y-4">
      <div className="mono-block inline-block mb-2">[Dashboard]</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="card p-4 space-y-1">
          <div className="text-xs text-slate-500">Total responses</div>
          <div className="text-2xl font-semibold text-slate-900">412</div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="text-xs text-slate-500">Average satisfaction (1–5)</div>
          <div className="text-2xl font-semibold text-slate-900">3.1</div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="text-xs text-slate-500">Top driver of dissatisfaction</div>
          <div className="text-sm font-semibold text-slate-900">Waiting time</div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center px-3 py-2 text-xs font-medium rounded bg-primary text-white"
      >
        Export Dashboard Data
      </button>
    </div>
  );
}

export default Step8Dashboard;

