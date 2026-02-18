import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { HEALTHCARE_EXAMPLE_SURVEY } from "../../../shared/demoData.js";
import { QUALITY_THRESHOLDS } from "../../../shared/constants";

const STORAGE_KEY = "dynamicSurveyDemoState";

const SurveyContext = createContext(null);

const defaultSurveyDraft = {
  title: "",
  goal: "",
  population: "",
  confidence: "95",
  margin: "5",
  language: [],
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
  const [surveyDraft, setSurveyDraft] = useState(defaultSurveyDraft);
  const [variableModel, setVariableModel] = useState(defaultVariableModelState);
  const [questionsState, setQuestionsState] = useState(defaultQuestionsState);
  const [stepStatus, setStepStatus] = useState(defaultStepStatus);
  const [evaluations, setEvaluations] = useState(defaultEvaluations);
  useEffect(() => {
    const initial = loadInitialState();
    setSurveyDraft(initial.surveyDraft);
    setVariableModel(initial.variableModel);
    setQuestionsState(initial.questionsState);
    setStepStatus(initial.stepStatus);
    setEvaluations(initial.evaluations);
  }, []);

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

  function saveSurveyDraft(draft) {
    const sampleSize = computeSampleSize(draft.confidence, draft.margin);
    setSurveyDraft({
      ...surveyDraft,
      ...draft,
      sampleSize,
      draftSaved: true
    });
    setStepStatus((prev) => ({
      ...prev,
      1: "completed",
      2: prev[2] === "locked" ? "unlocked" : prev[2]
    }));
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

  function resetDemoData() {
    setSurveyDraft(defaultSurveyDraft);
    setVariableModel(defaultVariableModelState);
    setQuestionsState(defaultQuestionsState);
    setStepStatus(defaultStepStatus);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  }

  function isStepUnlocked(step) {
    return stepStatus[step] === "unlocked" || stepStatus[step] === "completed";
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
    setEvaluations,
    saveSurveyDraft,
    loadHealthcareExample,
    setVariableModelFromAI,
    approveVariableModel,
    setQuestionsFromAI,
    updateQuestions,
    approveQuestions,
    completeQualityCheck,
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

