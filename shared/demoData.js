export const HEALTHCARE_EXAMPLE_SURVEY = {
  title: "Healthcare Satisfaction - RAK",
  goal: "Identify drivers of dissatisfaction",
  population: "RAK Residents (18+)",
  confidence: "95",
  margin: "5",
  language: ["English", "Arabic"],
  tone: "Neutral / Government",
  maxQuestions: 10
};

export const FALLBACK_QUESTIONS = {
  questions: [
    {
      id: "q1",
      text: "What is your age group?",
      type: "multiple_choice",
      variable: "Age group",
      variableRole: "control",
      options: ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
      required: true,
      branchFrom: null,
      branchCondition: null
    },
    {
      id: "q2",
      text: "What is your gender?",
      type: "multiple_choice",
      variable: "Gender",
      variableRole: "control",
      options: ["Male", "Female", "Prefer not to say"],
      required: true,
      branchFrom: null,
      branchCondition: null
    },
    {
      id: "q3",
      text: "Which area of RAK do you reside in?",
      type: "open_ended",
      variable: "Area",
      variableRole: "control",
      options: [],
      required: false,
      branchFrom: null,
      branchCondition: null
    },
    {
      id: "q4",
      text: "Overall, how satisfied are you with the healthcare services you received?",
      type: "likert",
      variable: "Overall satisfaction (1–5)",
      variableRole: "dependent",
      options: [
        "1 - Very dissatisfied",
        "2 - Dissatisfied",
        "3 - Neutral",
        "4 - Satisfied",
        "5 - Very satisfied"
      ],
      required: true,
      branchFrom: null,
      branchCondition: null
    },
    {
      id: "q5",
      text: "What aspects contributed most to your dissatisfaction?",
      type: "multi_select",
      variable: "Treatment effectiveness",
      variableRole: "driver",
      options: ["Long waiting time", "Unprofessional staff", "Ineffective treatment", "Poor facility conditions", "Unclear costs"],
      required: true,
      branchFrom: "q4",
      branchCondition: { questionId: "q4", operator: "lte", value: "2" }
    },
    {
      id: "q6",
      text: "How would you rate the waiting time before receiving care?",
      type: "likert",
      variable: "Waiting time",
      variableRole: "driver",
      options: [
        "1 - Very long",
        "2 - Long",
        "3 - Acceptable",
        "4 - Short",
        "5 - Very short"
      ],
      required: true,
      branchFrom: null,
      branchCondition: null
    },
    {
      id: "q7",
      text: "How would you rate the professionalism of the staff?",
      type: "likert",
      variable: "Staff professionalism",
      variableRole: "driver",
      options: [
        "1 - Very poor",
        "2 - Poor",
        "3 - Average",
        "4 - Good",
        "5 - Excellent"
      ],
      required: true,
      branchFrom: null,
      branchCondition: null
    },
    {
      id: "q8",
      text: "How would you rate the cleanliness of the facility?",
      type: "likert",
      variable: "Facility cleanliness",
      variableRole: "driver",
      options: [
        "1 - Very poor",
        "2 - Poor",
        "3 - Average",
        "4 - Good",
        "5 - Excellent"
      ],
      required: true,
      branchFrom: null,
      branchCondition: null
    },
    {
      id: "q9",
      text: "Were the costs and administrative processes clearly communicated?",
      type: "yes_no",
      variable: "Cost / process clarity",
      variableRole: "driver",
      options: ["Yes", "No"],
      required: true,
      branchFrom: null,
      branchCondition: null
    },
    {
      id: "q10",
      text: "What costs or processes were unclear? Please describe.",
      type: "open_ended",
      variable: "Cost / process clarity",
      variableRole: "driver",
      options: [],
      required: false,
      branchFrom: "q9",
      branchCondition: { questionId: "q9", operator: "equals", value: "No" }
    }
  ]
};

export const FALLBACK_VARIABLE_MODEL = {
  dependent: ["Overall satisfaction (1–5)"],
  drivers: [
    "Waiting time",
    "Staff professionalism",
    "Treatment effectiveness",
    "Facility cleanliness",
    "Accessibility",
    "Cost / process clarity"
  ],
  controls: [
    "Age group",
    "Gender",
    "Area",
    "Visit frequency",
    "Facility type"
  ]
};

