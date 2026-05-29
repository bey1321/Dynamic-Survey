import React from "react";
import { useToast } from "../state/ToastContext";
import { useTranslation } from "react-i18next";

function Step6Preview() {
  const { showToast } = useToast();
  const { t } = useTranslation(["common", "survey"]);

  function handleClick() {
    showToast(t("survey:step6Preview.toastNotImplemented"));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>{t("survey:step6Preview.title")}</h2>
        <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>{t("survey:step6Preview.subtitle")}</p>
      </div>

      <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "#d0eaea", backgroundColor: "#f8fdfd" }}>
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#2AABBA" }}>{t("survey:step6Preview.structureLabel")}</p>
        <div className="flex gap-4 text-sm">
          {[t("survey:step6Preview.structureItems.flowPreview"), t("survey:step6Preview.structureItems.exportFormats")].map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span style={{ color: "#5BBF8E" }}>✓</span>
              <span style={{ color: "#2d6a80" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* JSON preview */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#d0eaea" }}>
        <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: "#d0eaea", backgroundColor: "#e8f6f7" }}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#1B6B8A" }}>{t("survey:step6Preview.jsonPreviewLabel")}</span>
        </div>
        <pre className="px-5 py-4 text-xs overflow-x-auto font-mono leading-relaxed" style={{ backgroundColor: "#f8fdfd", color: "#2d6a80" }}>
{`{
  "surveyId": "healthcare-satisfaction-rak-v1",
  "title": "${t("survey:step6Preview.previewJson.title")}",
  "questions": [
    "${t("survey:step6Preview.previewJson.question1")}",
    "${t("survey:step6Preview.previewJson.question2")}",
    "${t("survey:step6Preview.previewJson.restQuestions")}"
  ]
}`}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleClick}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full text-white transition-colors duration-200"
          style={{ backgroundColor: "#1B6B8A" }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#2AABBA"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1B6B8A"; }}>
          {t("survey:step6Preview.exportJson")}
        </button>
        <button type="button" onClick={handleClick}
          className="text-sm font-semibold px-5 py-2.5 rounded-full border transition-colors duration-200"
          style={{ borderColor: "#2AABBA", color: "#1B6B8A" }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#e8f6f7"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
          {t("survey:step6Preview.exportCsv")}
        </button>
      </div>
    </div>
  );
}

export default Step6Preview;