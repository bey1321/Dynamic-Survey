import React from "react";
import { useNavigate } from "react-router-dom";
import rakscLogo from "../assets/raksc-logo.png";
import { useSurvey } from "../state/SurveyContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { initScratchMode } = useSurvey();

  const handleCreateWithAI = () => {
    navigate("/survey/step/1-create", { state: { mode: "ai" } });
  };

  const handleCreateFromScratch = () => {
    initScratchMode();
    navigate("/survey/step/3-questions");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f0f8f8" }}>
      {/* Navbar */}
      <nav
        className="flex items-center justify-between px-10 py-4 border-b"
        style={{ backgroundColor: "#ffffff", borderColor: "#d0eaea" }}
      >
        {/* Logo */}
        <div className="flex items-center">
          <img src={rakscLogo} alt="RAK Statistics Logo" className="h-14 w-auto object-contain" />
        </div>


      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-24">
        {/* Badge */}
        <span
          className="text-xs font-bold tracking-[0.2em] mt-6 uppercase mb-6 px-4 py-1.5 rounded-full"
          style={{ color: "#1B6B8A", backgroundColor: "#d0eaea" }}
        >
          Survey Maker
        </span>

        {/* Heading */}
        <h1
          className="text-5xl md:text-6xl lg:text-7xl font-serif font-semibold leading-tight max-w-3xl mb-6"
          style={{ color: "#1B6B8A" }}
        >
          The smarter way to build surveys
        </h1>

        {/* Accent underline */}
        <div
          className="w-20 h-1 rounded-full mb-8"
          style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }}
        />

        {/* Subheading */}
        <p className="text-lg max-w-xl mb-10" style={{ color: "#5a8a8a" }}>
          Create AI-powered, dynamic surveys designed to collect better data and deeper insights.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleCreateWithAI}
            className="text-white text-base font-semibold px-8 py-4 rounded-full transition-colors duration-200 shadow-lg"
            style={{ backgroundColor: "#1B6B8A" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#2AABBA")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#1B6B8A")}
          >
            ✦ Create with AI
          </button>
          <button
            onClick={handleCreateFromScratch}
            className="text-base font-semibold px-8 py-4 rounded-full transition-colors duration-200 border-2"
            style={{ color: "#1B6B8A", borderColor: "#1B6B8A", backgroundColor: "transparent" }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "#1B6B8A";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#1B6B8A";
            }}
          >
            Create from scratch
          </button>
        </div>
      </main>

      {/* Footer accent bar */}
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }}
      />
    </div>
  );
}
