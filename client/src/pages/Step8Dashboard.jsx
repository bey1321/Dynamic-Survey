import React from "react";
import { useToast } from "../state/ToastContext";
import { useTranslation } from "react-i18next";

function Step8Dashboard() {
  const { showToast } = useToast();
  const { t } = useTranslation(["common","survey"]);

  function handleClick() {
    showToast(t("survey:step8Dashboard.toastNotImplemented"));
  }

  const metrics = [
    { label: t("survey:step8Dashboard.metrics.totalResponses.label"), value: "412", sub: t("survey:step8Dashboard.metrics.totalResponses.sub"), accent: "#1B6B8A" },
    { label: t("survey:step8Dashboard.metrics.avgSatisfaction.label"), value: "3.1", sub: t("survey:step8Dashboard.metrics.avgSatisfaction.sub"), accent: "#2AABBA" },
    { label: t("survey:step8Dashboard.metrics.topDriver.label"), value: t("survey:step8Dashboard.metrics.topDriver.value"), sub: t("survey:step8Dashboard.metrics.topDriver.sub"), accent: "#5BBF8E" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#1B6B8A" }}>{t("survey:step8Dashboard.title")}</h2>
        <p className="text-sm mt-0.5" style={{ color: "#9ab8c0" }}>{t("survey:step8Dashboard.subtitle")}</p>
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
        {t("survey:step8Dashboard.exportButton")}
      </button>
    </div>
  );
}

export default Step8Dashboard;