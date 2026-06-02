import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { HEALTHCARE_EXAMPLE_SURVEY } from "../../../shared/demoData.js";
import { QUALITY_THRESHOLDS } from "../../../shared/constants";

const STORAGE_KEY = "dynamicSurveyDemoState";
const SURVEY_ID_KEY = "dynamicSurveySavedId";

const SurveyContext = createContext(null);

const defaultSurveyDraft = {
  title: "",
  goal: "",
  population: "",
  confidence: "95",
  margin: "5",
  language: "English",
  tone: "Neutral / Government",
  maxQuestions: 10,
  sampleSize: null,
  draftSaved: false
};

const defaultVariableModelState = {
  model: null,
  status: "Not generated",
  approvedVersion: 0,
  lastApprovedAt: null
};

const defaultQuestionsState = {
  questions: null,
  status: "Not generated",
  approvedVersion: 0,
  lastApprovedAt: null
};

const defaultStepStatus = {
  1: "unlocked",
  2: "locked",
  3: "locked",
  4: "locked",
  5: "locked",
  6: "locked",
  7: "locked",
  8: "unlocked"
};

const defaultEvaluations = [];

function loadInitialState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        surveyDraft: defaultSurveyDraft,
        variableModel: defaultVariableModelState,
        questionsState: defaultQuestionsState,
        stepStatus: defaultStepStatus
      };
    }
    const parsed = JSON.parse(raw);
    return {
      surveyDraft: { ...defaultSurveyDraft, ...(parsed.surveyDraft || {}) },
      variableModel: { ...defaultVariableModelState, ...(parsed.variableModel || {}) },
      questionsState: { ...defaultQuestionsState, ...(parsed.questionsState || {}) },
      stepStatus: { ...defaultStepStatus, ...(parsed.stepStatus || {}) },
      evaluations: parsed.evaluations || []
    };
  } catch {
    return {
      surveyDraft: defaultSurveyDraft,
      variableModel: defaultVariableModelState,
      questionsState: defaultQuestionsState,
      stepStatus: defaultStepStatus,
      evaluations: []
    };
  }
}

export function SurveyProvider({ children }) {
  // Load from localStorage synchronously via lazy initializers.
  // This ensures the first render already has the correct state, eliminating
  // the async race where children would see stale defaults before a useEffect
  // loaded localStorage — which broke auto-generation on navigation.
  const [surveyDraft, setSurveyDraft] = useState(() => loadInitialState().surveyDraft);
  const [variableModel, setVariableModel] = useState(() => loadInitialState().variableModel);
  const [questionsState, setQuestionsState] = useState(() => loadInitialState().questionsState);
  const [stepStatus, setStepStatus] = useState(() => loadInitialState().stepStatus);
  const [evaluations, setEvaluations] = useState(() => loadInitialState().evaluations || []);
  const [surveyMode, setSurveyMode] = useState("ai");
  const [savedSurveyId, setSavedSurveyId] = useState(() => {
    try { return window.localStorage.getItem(SURVEY_ID_KEY) || null; } catch { return null; }
  });

  useEffect(() => {
    const payload = JSON.stringify({
      surveyDraft,
      variableModel,
      questionsState,
      stepStatus,
      evaluations
    });
    try {
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch {
    }
  }, [surveyDraft, variableModel, questionsState, stepStatus, evaluations]);

  useEffect(() => {
    try {
      if (savedSurveyId) window.localStorage.setItem(SURVEY_ID_KEY, savedSurveyId);
      else window.localStorage.removeItem(SURVEY_ID_KEY);
    } catch {}
  }, [savedSurveyId]);

  const globalStatus = useMemo(() => {
    if (variableModel.approvedVersion > 0) {
      return `Variable Model Approved (v${variableModel.approvedVersion})`;
    }
    if (surveyDraft.draftSaved) {
      return "Draft";
    }
    return "Draft";
  }, [surveyDraft.draftSaved, variableModel.approvedVersion]);

  function computeSampleSize(confidence, margin) {
    const Z_MAP = {
      "90": 1.645,
      "95": 1.96,
      "99": 2.576
    };
    const E_MAP = {
      "3": 0.03,
      "5": 0.05,
      "7": 0.07
    };
    const Z = Z_MAP[String(confidence)] || 1.96;
    const e = E_MAP[String(margin)] || 0.05;
    const p = 0.5;
    const n = (Z * Z * p * (1 - p)) / (e * e);
    return Math.round(n);
  }

  function saveSurveyDraft(draft, mode = "ai") {
    const sampleSize = computeSampleSize(draft.confidence, draft.margin);
    // Only invalidate downstream AI results when fields that affect generation change.
    const generationFields = ["title", "goal", "population", "confidence", "margin", "language", "tone", "maxQuestions"];
    const configChanged = generationFields.some((k) => draft[k] !== surveyDraft[k]);
    setSurveyDraft({
      ...surveyDraft,
      ...draft,
      sampleSize,
      draftSaved: true
    });
    if (configChanged) {
      setVariableModel(defaultVariableModelState);
      setQuestionsState(defaultQuestionsState);
      setEvaluations([]);
      setSavedSurveyId(null);
    }
    if (mode === "scratch") {
      setStepStatus((prev) => ({
        ...prev,
        1: "completed",
        2: "skipped",
        3: "unlocked",
        4: "locked",
        5: "locked",
        6: "locked",
        7: "locked"
      }));
    } else {
      setStepStatus((prev) => ({
        ...prev,
        1: "completed",
        2: "unlocked",
        3: "locked",
        4: "locked",
        5: "locked",
        6: "locked",
        7: "locked"
      }));
    }
    return sampleSize;
  }

  function loadHealthcareExample() {
    const example = HEALTHCARE_EXAMPLE_SURVEY;
    const sampleSize = computeSampleSize(example.confidence, example.margin);
    const updatedSurvey = {
      ...surveyDraft,
      ...example,
      sampleSize,
      draftSaved: true
    };
    setSurveyDraft(updatedSurvey);
    setStepStatus((prev) => ({
      ...prev,
      1: "completed",
      2: "unlocked"
    }));
  }

  function setVariableModelFromAI(model) {
    if (!model || !Array.isArray(model.dependent) || !Array.isArray(model.drivers) || !Array.isArray(model.controls)) {
      return;
    }
    setVariableModel((prev) => ({
      ...prev,
      model,
      status: "Generated"
    }));
  }

  function approveVariableModel(updatedModel) {
    setVariableModel((prev) => {
      const nextVersion = (prev.approvedVersion || 0) + 1;
      return {
        ...prev,
        model: updatedModel || prev.model,
        approvedVersion: nextVersion,
        status: `Variable Model Approved (v${nextVersion})`,
        lastApprovedAt: new Date().toISOString()
      };
    });
    setStepStatus((prev) => ({
      ...prev,
      2: "completed",
      3: "unlocked"
    }));
  }

  function setQuestionsFromAI(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return;
    }
    setQuestionsState((prev) => ({
      ...prev,
      questions,
      status: "Generated"
    }));
  }

  function updateQuestions(questions) {
    setQuestionsState((prev) => ({
      ...prev,
      questions: Array.isArray(questions) ? questions : prev.questions,
      approvedVersion: 0,
      status: "Generated"
    }));
  }

  function approveQuestions() {
    setQuestionsState((prev) => {
      const nextVersion = (prev.approvedVersion || 0) + 1;
      return {
        ...prev,
        approvedVersion: nextVersion,
        status: `Questions Approved (v${nextVersion})`,
        lastApprovedAt: new Date().toISOString()
      };
    });
    setStepStatus((prev) => ({
      ...prev,
      3: "completed",
      4: "unlocked"
    }));
  }
  function completeQualityCheck() {
  setStepStatus((prev) => ({
    ...prev,
    4: "completed",
    5: prev[5] === "locked" ? "unlocked" : prev[5]
  }));
  }

  function initScratchMode() {
    setSurveyMode("scratch");
    setSurveyDraft(defaultSurveyDraft);
    setVariableModel(defaultVariableModelState);
    setQuestionsState(defaultQuestionsState);
    setEvaluations([]);
    setStepStatus((prev) => ({
      ...prev,
      1: "skipped",
      2: "skipped",
      3: "unlocked",
      4: "locked",
      5: "locked",
      6: "locked",
      7: "locked"
    }));
  }

  function loadFromSnapshot(snapshot, surveyId = null) {
    if (!snapshot) return;
    if (surveyId) setSavedSurveyId(surveyId);

    // surveyDraft is the same in both formats
    if (snapshot.surveyDraft) {
      setSurveyDraft({ ...defaultSurveyDraft, ...snapshot.surveyDraft });
    }

    // variableModel:
    //   DB format  → snapshot.variableModel is the raw model { dependent, drivers, controls }
    //   ctx format → snapshot.variableModel is { model: {...}, status, approvedVersion, … }
    if (snapshot.variableModel) {
      if (snapshot.variableModel.model !== undefined) {
        setVariableModel({ ...defaultVariableModelState, ...snapshot.variableModel });
      } else {
        setVariableModel({ ...defaultVariableModelState, model: snapshot.variableModel, status: 'Generated' });
      }
    }

    // questions:
    //   DB format  → snapshot.questions is the raw array
    //   ctx format → snapshot.questionsState is { questions: [], status, … }
    if (Array.isArray(snapshot.questions)) {
      setQuestionsState({ ...defaultQuestionsState, questions: snapshot.questions, status: 'Generated' });
    } else if (snapshot.questionsState) {
      setQuestionsState({ ...defaultQuestionsState, ...snapshot.questionsState });
    }

    // stepStatus:
    //   DB format doesn't include it — infer from what was saved
    if (snapshot.stepStatus) {
      setStepStatus({ ...defaultStepStatus, ...snapshot.stepStatus });
    } else {
      setStepStatus({
        ...defaultStepStatus,
        1: 'completed',
        2: snapshot.variableModel ? 'completed' : 'skipped',
        3: 'unlocked',
      });
    }

    if (snapshot.evaluations) setEvaluations(snapshot.evaluations);
    if (snapshot.surveyMode)  setSurveyMode(snapshot.surveyMode);
  }

  function resetDemoData() {
    setSurveyDraft(defaultSurveyDraft);
    setVariableModel(defaultVariableModelState);
    setQuestionsState(defaultQuestionsState);
    setStepStatus(defaultStepStatus);
    setSavedSurveyId(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SURVEY_ID_KEY);
    } catch {
    }
  }

  function isStepUnlocked(step) {
    return stepStatus[step] === "unlocked" || stepStatus[step] === "completed" || stepStatus[step] === "skipped";
  }

  function hasEvaluationIssues(thresholds = {}) {

  const T = {
    ...QUALITY_THRESHOLDS,
    ...thresholds
  };

  return evaluations.some(e =>
    e.llm_scores.relevance < T.minLLM ||
    e.llm_scores.clarity < T.minLLM ||
    e.llm_scores.answerability < T.minLLM ||
    e.variable_relevance < T.minVariableRelevance ||
    e.max_duplicate_similarity > T.maxDuplicate ||
    e.rule_violations.length > 0 ||
    (e.response_option_issues?.length ?? 0) > 0 ||
    e.skip_logic_issue ||
    e.response_scale_issue
  );
}

  const value = {
    surveyDraft,
    variableModel,
    questionsState,
    stepStatus,
    globalStatus,
    evaluations,
    surveyMode,
    setSurveyMode,
    setEvaluations,
    savedSurveyId,
    setSavedSurveyId,
    saveSurveyDraft,
    loadHealthcareExample,
    setVariableModelFromAI,
    approveVariableModel,
    setQuestionsFromAI,
    updateQuestions,
    approveQuestions,
    completeQualityCheck,
    initScratchMode,
    loadFromSnapshot,
    resetDemoData,
    isStepUnlocked,
    hasEvaluationIssues
  };

  return <SurveyContext.Provider value={value}>{children}</SurveyContext.Provider>;
}

export function useSurvey() {
  const ctx = useContext(SurveyContext);
  if (!ctx) {
    throw new Error("useSurvey must be used within SurveyProvider");
  }
  return ctx;
}

