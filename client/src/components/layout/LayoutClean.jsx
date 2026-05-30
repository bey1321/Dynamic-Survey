import { useNavigate } from "react-router-dom";
import { useSurvey } from "../../state/SurveyContext";
import { StepNavProvider } from "../../state/StepNavContext";
import HorizontalStepper from "../navigation/HorizontalStepper";
import ToastContainer from "./ToastContainer";
import rakscLogo from "../../assets/raksc-logo.png";
import { useTranslation } from "react-i18next";

function LayoutClean({ children }) {
  const navigate = useNavigate();
  const { surveyDraft, globalStatus, surveyMode } = useSurvey();
  const { t, i18n } = useTranslation("common");

  const title =
    surveyDraft.title && surveyDraft.title.trim().length > 0
      ? surveyDraft.title
      : t("untitledSurvey");

  return (
    <div
      dir={i18n.language === "ar" ? "rtl" : "ltr"}
      lang={i18n.language === "ar" ? "ar" : "en"}
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#f0f8f8" }}
    >
      {/* Top navbar */}
      <header
        className="flex items-center justify-between px-8 py-3 border-b"
        style={{ backgroundColor: "#ffffff", borderColor: "#d0eaea" }}
      >
        {/* Logo */}
        <button onClick={() => navigate("/")} className="focus:outline-none">
          <img
            src={rakscLogo}
            alt="RAK Statistics Logo"
            className="h-10 w-auto object-contain"
          />
        </button>

        {/* Survey title */}
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

        {/* Language toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => i18n.changeLanguage("en")}
            className={`px-3 py-1 rounded text-sm font-medium border ${
              i18n.language === "en" ? "text-white" : "text-[#1B6B8A]"
            }`}
            style={{
              backgroundColor: i18n.language === "en" ? "#1B6B8A" : "#ffffff",
              borderColor: "#b0d4dc",
            }}
          >
            {t("english")}
          </button>

          <button
            type="button"
            onClick={() => i18n.changeLanguage("ar")}
            className={`px-3 py-1 rounded text-sm font-medium border ${
              i18n.language === "ar" ? "text-white" : "text-[#1B6B8A]"
            }`}
            style={{
              backgroundColor: i18n.language === "ar" ? "#1B6B8A" : "#ffffff",
              borderColor: "#b0d4dc",
            }}
          >
            {t("arabic")}
          </button>
        </div>
      </header>

      {/* Horizontal step progress */}
      {surveyMode !== "scratch" && <HorizontalStepper />}

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
        style={{
          background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)",
        }}
      />

      <ToastContainer />
    </div>
  );
}

export default LayoutClean;
