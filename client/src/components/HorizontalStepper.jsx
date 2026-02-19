import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";

const STEPS = [
  { id: 1, label: "Create",     path: "/survey/step/1-create"     },
  { id: 2, label: "Variables",  path: "/survey/step/2-variables"  },
  { id: 3, label: "Questions",  path: "/survey/step/3-questions"  },
  { id: 4, label: "Audit",      path: "/survey/step/4-audit"      },
  { id: 5, label: "Simulation", path: "/survey/step/5-simulation" },
  { id: 6, label: "Preview",    path: "/survey/step/6-preview"    },
];

const BRAND = {
  dark:     "#1B6B8A",
  teal:     "#2AABBA",
  green:    "#5BBF8E",
  inactive: "#c8d8dc",
  text:     "#1B6B8A",
  mutedText:"#9ab8c0",
};

export default function HorizontalStepper() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isStepUnlocked } = useSurvey();

  const currentIndex = STEPS.findIndex((s) => pathname.startsWith(s.path));

  return (
    <div className="w-full bg-white border-b px-8 py-6" style={{ borderColor: "#d0eaea" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isActive    = idx === currentIndex;
            const unlocked    = isStepUnlocked(step.id);
            const isLast      = idx === STEPS.length - 1;

            const circleColor = isCompleted
              ? BRAND.green
              : isActive
              ? BRAND.dark
              : BRAND.inactive;

            const labelColor = isCompleted || isActive ? BRAND.text : BRAND.mutedText;

            return (
              <React.Fragment key={step.id}>
                {/* Step node */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => unlocked && navigate(step.path)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none"
                    style={{
                      backgroundColor: circleColor,
                      cursor: unlocked ? "pointer" : "default",
                      boxShadow: isActive ? `0 0 0 4px ${BRAND.dark}22` : "none",
                    }}
                    title={step.label}
                  >
                    {isCompleted ? (
                      /* Checkmark */
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2.5 7L5.5 10L11.5 4"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : isActive ? (
                      /* Filled dot */
                      <span className="w-2.5 h-2.5 rounded-full bg-white block" />
                    ) : (
                      /* Empty dot */
                      <span
                        className="w-2.5 h-2.5 rounded-full block"
                        style={{ backgroundColor: "#b0cdd4" }}
                      />
                    )}
                  </button>

                  {/* Label */}
                  <span
                    className="text-[10px] font-bold tracking-widest uppercase whitespace-nowrap"
                    style={{ color: labelColor }}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div className="flex-1 h-[2px] mx-1 mb-5 rounded-full" style={{
                    backgroundColor: idx < currentIndex ? BRAND.green : BRAND.inactive,
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
