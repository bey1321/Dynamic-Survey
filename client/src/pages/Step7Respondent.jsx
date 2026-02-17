import React from "react";
import { useToast } from "../state/ToastContext";

function Step7Respondent() {
  const { showToast } = useToast();

  function handleClick() {
    showToast("Not implemented in this prototype – handled by another team.");
  }

  return (
    <div className="space-y-4">
      <div className="mono-block inline-block mb-2">[Respondent Experience (Mobile UI)]</div>

      <div className="max-w-xs border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
        <div className="text-xs text-slate-500 mb-2">Healthcare Satisfaction - RAK</div>
        <div className="text-sm font-semibold text-slate-900 mb-3">
          Q1. Overall, how satisfied are you with the healthcare services you received in RAK?
        </div>
        <div className="space-y-1 text-sm text-slate-800">
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            1 - Very dissatisfied
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            2 - Dissatisfied
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            3 - Neutral
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            4 - Satisfied
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            5 - Very satisfied
          </button>
        </div>
      </div>
    </div>
  );
}

export default Step7Respondent;

