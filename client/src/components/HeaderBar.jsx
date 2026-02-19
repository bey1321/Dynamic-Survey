import React from "react";
import { NavLink } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";

function HeaderBar() {
  const { surveyDraft, globalStatus, resetDemoData } = useSurvey();

  const title = surveyDraft.title && surveyDraft.title.trim().length > 0 ? surveyDraft.title : "Untitled Survey";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Status: {globalStatus}
            </span>
          </div>
          <nav className="flex items-center gap-4 text-xs">
            <NavLink
              to="/step/1-create"
              className={({ isActive }) =>
                isActive ? "text-primary font-semibold" : "text-slate-600 hover:text-slate-900"
              }
            >
              Survey
            </NavLink>
            <NavLink
              to="/step/8-dashboard"
              className={({ isActive }) =>
                isActive ? "text-primary font-semibold" : "text-slate-600 hover:text-slate-900"
              }
            >
              Dashboard
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Reset Data
          </button>
        </div>
      </div>
    </header>
  );
}

export default HeaderBar;

