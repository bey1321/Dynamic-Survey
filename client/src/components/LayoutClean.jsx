import React from "react";
import { useNavigate } from "react-router-dom";
import { useSurvey } from "../state/SurveyContext";
import { StepNavProvider } from "../state/StepNavContext";
import HorizontalStepper from "./HorizontalStepper";
import ToastContainer from "./ToastContainer";
import { ChatSidebar } from "./ChatSidebar";
import rakscLogo from "../assets/raksc-logo.png";

function LayoutClean({ children }) {
  const navigate = useNavigate();
  const { surveyDraft, globalStatus, resetDemoData } = useSurvey();
  const title =
    surveyDraft.title && surveyDraft.title.trim().length > 0
      ? surveyDraft.title
      : "Untitled Survey";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f0f8f8" }}>
      {/* Top navbar */}
      <header
        className="flex items-center justify-between px-8 py-3 border-b"
        style={{ backgroundColor: "#ffffff", borderColor: "#d0eaea" }}
      >
        {/* Logo */}
        <button onClick={() => navigate("/")} className="focus:outline-none">
          <img src={rakscLogo} alt="RAK Statistics Logo" className="h-10 w-auto object-contain" />
        </button>

        {/* Survey title + status */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-sm font-semibold" style={{ color: "#1B6B8A" }}>
            {title}
          </span>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#d0eaea", color: "#1B6B8A" }}
          >
            {globalStatus}
          </span>
        </div>

        {/* Reset */}

      </header>

      {/* Horizontal step progress */}
      <HorizontalStepper />

      {/* Page content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        <div
          className="rounded-2xl shadow-sm border p-8"
          style={{ backgroundColor: "#ffffff", borderColor: "#d0eaea" }}
        >
          <StepNavProvider base="/survey/step">
            {children}
          </StepNavProvider>
        </div>
      </main>

      {/* Footer accent */}
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }}
      />

      <ToastContainer />
      <ChatSidebar />
    </div>
  );
}

export default LayoutClean;
