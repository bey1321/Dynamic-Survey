import React from "react";
import { useToast } from "../state/ToastContext";
import { useTranslation } from "react-i18next";

function Step7Respondent() {
  const { showToast } = useToast();
  const { t } = useTranslation(["common", "survey"]);

  function handleClick() {
    showToast(t("survey:step7Respondent.toastNotImplemented"));
  }

  return (
    <div className="space-y-4">
      <div className="mono-block inline-block mb-2">{t("survey:step7Respondent.mobileUiLabel")}</div>

      <div className="max-w-xs border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
        <div className="text-xs text-slate-500 mb-2">{t("survey:step7Respondent.surveyTitle")}</div>
        <div className="text-sm font-semibold text-slate-900 mb-3">
          {t("survey:step7Respondent.question")}
        </div>
        <div className="space-y-1 text-sm text-slate-800">
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            {t("survey:step7Respondent.options.veryDissatisfied")}
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            {t("survey:step7Respondent.options.dissatisfied")}
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            {t("survey:step7Respondent.options.neutral")}
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            {t("survey:step7Respondent.options.satisfied")}
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="w-full text-left px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
          >
            {t("survey:step7Respondent.options.verySatisfied")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Step7Respondent;