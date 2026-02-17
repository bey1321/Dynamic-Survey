import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";

const steps = [
  { id: 1, label: "STEP 1 — Create Survey (Admin Input)", path: "/step/1-create" },
  { id: 2, label: "STEP 2 — Build Variable Model (AI)", path: "/step/2-variables" },
  { id: 3, label: "STEP 3 — Generate Questions (AI)", path: "/step/3-questions" },
  { id: 4, label: "STEP 4 — Quality Check (Bias + Validity)", path: "/step/4-audit" },
  { id: 5, label: "STEP 5 — Simulation (Stress Test + Branching)", path: "/step/5-simulation" },
  { id: 6, label: "STEP 6 — Final Survey Preview + Export", path: "/step/6-preview" }
];

function SidebarStepper() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isStepUnlocked } = useSurvey();

  return (
    <nav className="card p-4">
      <ol className="space-y-2">
        {steps.map((step) => {
          const isActive = pathname.startsWith(step.path);
          const unlocked = isStepUnlocked(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => unlocked && navigate(step.path)}
                className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded text-sm ${
                  isActive
                    ? "bg-primary text-white"
                    : unlocked
                    ? "hover:bg-slate-100 text-slate-800"
                    : "step-disabled bg-slate-50"
                }`}
              >
                <span className="w-6 text-xs font-semibold">{step.id})</span>
                <span className="flex-1">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default SidebarStepper;

