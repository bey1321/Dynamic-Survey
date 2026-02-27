# Dynamic Survey Generator

An AI-powered survey creation platform that guides users through a structured multi-step workflow — from defining a research goal to generating, evaluating, and refining a complete survey instrument. Built with React (frontend) and Express + Google Gemini (backend).

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Environment Setup](#4-environment-setup)
5. [Running the App](#5-running-the-app)
6. [Step-by-Step Workflow](#6-step-by-step-workflow)
   - [Step 1 — Create Survey](#step-1--create-survey)
   - [Step 2 — Variable Model](#step-2--variable-model)
   - [Step 3 — Generate Questions](#step-3--generate-questions)
   - [Step 4 — Quality Audit](#step-4--quality-audit)
   - [Step 5 — Simulation (Stub)](#step-5--simulation-stub)
   - [Step 6 — Preview & Export (Stub)](#step-6--preview--export-stub)
   - [Step 8 — Dashboard (Stub)](#step-8--dashboard-stub)
7. [API Reference](#7-api-reference)
8. [AI & Prompt System](#8-ai--prompt-system)
9. [Quality Evaluation Pipeline](#9-quality-evaluation-pipeline)
10. [State Management](#10-state-management)
11. [Chat Assistant](#11-chat-assistant)
12. [Branching / Skip Logic](#12-branching--skip-logic)
13. [Data Persistence](#13-data-persistence)
14. [Shared Modules](#14-shared-modules)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│                                                                 │
│  Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 → Step 8  │
│  (Create)  (Vars)  (Qs)   (Audit) (Sim)   (Preview) (Dash)     │
│                                                                 │
│  React + React Router + TailwindCSS + xyflow                    │
│  State: SurveyContext (localStorage-persisted)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (Vite proxy /api → :4000)
┌────────────────────────▼────────────────────────────────────────┐
│                     EXPRESS SERVER (:4000)                       │
│                                                                 │
│  /api/variable-model        → Gemini → Variable Model JSON      │
│  /api/generate-questions    → Gemini → Validated Questions JSON  │
│  /api/extract-survey-config → Gemini → Survey Config JSON        │
│  /api/evaluate-questions    → Gemini + Xenova → Quality Report   │
│  /api/chat                  → Gemini → Conversational Response   │
└────────────────────────┬────────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Google Gemini API  │  (LLM: generation, scoring)
              └─────────────────────┘
              ┌──────────────────────┐
              │ Xenova/all-MiniLM-L6 │  (local embeddings: similarity)
              └──────────────────────┘
```

The app enforces a **linear step lock** — each step only unlocks after the previous one is completed. State (including all generated content) is persisted to `localStorage` so the session survives page refreshes.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + React Router DOM 6 |
| Build Tool | Vite 5 |
| Styling | TailwindCSS 3.4 |
| Flow Diagrams | xyflow 12 |
| Icons | Lucide React |
| Backend | Express 4 (Node.js ESM) |
| AI / LLM | Google Gemini API (`@google/genai`) |
| Local Embeddings | Xenova/transformers (`all-MiniLM-L6-v2`) |
| State Management | React Context API (no Redux) |

---

## 3. Project Structure

```
Dynamic Survey/
├── shared/                        # Shared between client and server
│   ├── promptTemplates.js         # All Gemini prompt strings & builders
│   ├── demoData.js                # Fallback data & healthcare example
│   └── constants.js               # Quality thresholds
│
├── server/
│   ├── index.js                   # Express API server (all routes)
│   ├── evaluator.js               # Question quality pipeline
│   ├── package.json
│   └── .env                       # API keys (see Environment Setup)
│
├── client/
│   ├── vite.config.js             # Dev server + proxy config
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx                # Router setup + route definitions
│       ├── pages/
│       │   ├── HomePage.jsx       # Landing page
│       │   ├── Step1CreateSurvey.jsx
│       │   ├── Step2VariableModel.jsx
│       │   ├── Step3Questions.jsx
│       │   ├── Step4Audit.jsx
│       │   ├── Step5Simulation.jsx
│       │   ├── Step6Preview.jsx
│       │   └── Step8Dashboard.jsx
│       ├── components/
│       │   ├── Layout.jsx              # Sidebar layout wrapper
│       │   ├── LayoutClean.jsx         # Horizontal stepper layout
│       │   ├── SidebarStepper.jsx      # Vertical step indicator
│       │   ├── HorizontalStepper.jsx   # Horizontal progress bar
│       │   ├── HeaderBar.jsx           # Top navigation + reset
│       │   ├── ChatSidebar.jsx         # AI chat assistant panel
│       │   ├── QuestionEditorSidebar.jsx # Right sidebar (Step 3)
│       │   ├── SurveyFlowVisualization.jsx # xyflow diagram
│       │   └── ToastContainer.jsx      # Toast notification display
│       └── state/
│           ├── SurveyContext.jsx       # Main app state
│           ├── StepNavContext.jsx      # Route base path
│           ├── ChatContext.jsx         # Chat state & API calls
│           └── ToastContext.jsx        # Toast notifications
│
└── package.json                   # Root monorepo scripts
```

---

## 4. Environment Setup

Create `server/.env`:

```env
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
```

If the key is missing, all AI generation falls back to hardcoded demo data (`shared/demoData.js`) so the UI remains functional.

Install dependencies:

```bash
npm install          # root
cd client && npm install
cd ../server && npm install
```

---

## 5. Running the App

```bash
# From root — runs both client and server concurrently
npm run dev

# Or separately:
# Terminal 1 — backend
cd server && node index.js

# Terminal 2 — frontend
cd client && npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Vite proxies all `/api/*` requests from the frontend to the backend automatically.

---

## 6. Step-by-Step Workflow

### Step 1 — Create Survey

**Purpose**: Capture the core survey configuration.

**Inputs (form fields)**:

| Field | Type | Required | Description |
|---|---|---|---|
| Survey Title | Text | Yes | Short name for the survey |
| Survey Goal | Text | Yes | What you want to learn (drives AI generation) |
| Target Population | Text | Yes | Who will answer (e.g. "RAK Residents 18+") |
| Tone | Select | No | Neutral/Govt, Friendly, Formal |
| Max Questions | Number | No | Upper limit for question generation |
| Languages | Checkboxes | No | English and/or Arabic |
| Confidence Level | Select | Hidden | 90%, 95%, 99% (default: 95%) |
| Margin of Error | Select | Hidden | ±3%, ±5%, ±7% (default: ±5%) |

**Alternative Inputs**:
- **Load Healthcare Example**: Pre-fills all fields with a sample RAK healthcare satisfaction survey.
- **Import from File**: Upload a `.txt` file → calls `/api/extract-survey-config` → Gemini reads it and auto-fills the form fields.

**On Submit**:
1. Validates that Title, Goal, and Population are filled.
2. Computes sample size: `n = (Z² × 0.5 × 0.5) / e²` using confidence/margin values.
3. Calls `saveSurveyDraft()` in `SurveyContext` which:
   - Stores the draft.
   - **Clears all downstream state** (variable model, questions, evaluations) to avoid stale data.
   - Relocks Steps 3–7.
   - Unlocks Step 2.
4. Navigates to Step 2 with a `location.state.autoGenerate = true` flag that tells Step 2 to start generating immediately.

**Outputs stored in state**:
```js
surveyDraft: {
  title, goal, population, confidence, margin,
  language, tone, maxQuestions, sampleSize,
  draftSaved: true
}
```

---

### Step 2 — Variable Model

**Purpose**: Generate a structured research variable model from the survey goal.

**Inputs** (sent to `/api/variable-model`):
```json
{
  "title": "...",
  "goal": "...",
  "population": "...",
  "confidence": "95",
  "margin": "5",
  "language": ["English"],
  "tone": "Neutral / Government",
  "maxQuestions": 10
}
```

**AI Output** (from Gemini):
```json
{
  "dependent": ["Overall Satisfaction with Healthcare"],
  "drivers": ["Wait Time", "Staff Friendliness", "Facility Cleanliness"],
  "controls": ["Age", "Gender", "District of Residence"]
}
```

| Category | Role | Color | Description |
|---|---|---|---|
| Dependent | Primary Outcome | Dark Blue | The main thing being measured |
| Drivers | Independent Variables | Teal | Factors that influence the outcome |
| Controls | Demographics | Green | Background characteristics of respondents |

**Auto-generation logic**:
- Triggers automatically if arriving from Step 1 (via `location.state.autoGenerate`).
- Falls back to auto-trigger if the model is empty and the step is unlocked.
- A `useRef` guard prevents duplicate API calls if both effects fire simultaneously.

**User Actions**:
- **Edit**: Toggle edit mode to add, remove, or rename variables.
- **Regenerate**: Call Gemini again with the same survey config to get a fresh model.
- **Next**: Navigate to Step 3 (passing `autoGenerate: true` flag to trigger question generation).

**Fallback**: If generation fails, the previous model is restored and an error message shown.

**On Next**: Stored in `SurveyContext`:
```js
variableModel: {
  model: { dependent: [...], drivers: [...], controls: [...] },
  status: "Generated"
}
```

---

### Step 3 — Generate Questions

**Purpose**: Generate a full survey question set from the variable model.

**Inputs** (sent to `/api/generate-questions`):
```json
{
  "surveyDraft": { ... },
  "variableModel": { "dependent": [...], "drivers": [...], "controls": [...] },
  "previousQuestions": null
}
```

**AI Output** — array of question objects:
```json
{
  "questions": [
    {
      "id": "q1",
      "text": "What is your age group?",
      "type": "multiple_choice",
      "variable": "Age",
      "variableRole": "control",
      "options": ["Under 18", "18-34", "35-54", "55+"],
      "required": true,
      "branchFrom": null,
      "branchCondition": null
    },
    {
      "id": "q5",
      "text": "How satisfied are you with the cleanliness of the facility?",
      "type": "likert",
      "variable": "Facility Cleanliness",
      "variableRole": "driver",
      "options": ["1 - Very Dissatisfied", "2 - Dissatisfied", "3 - Neutral", "4 - Satisfied", "5 - Very Satisfied"],
      "required": true,
      "branchFrom": "q2",
      "branchCondition": { "questionId": "q2", "operator": "equals", "value": "Yes" }
    }
  ]
}
```

**Question Types**:

| Type | Description |
|---|---|
| `likert` | 1–5 agreement scale |
| `multiple_choice` | Single-select options |
| `multi_select` | Checkbox-style multi-select |
| `yes_no` | Binary Yes/No |
| `open_ended` | Free text field |
| `rating` | Numeric 1–10 scale |

**Tabs**:

- **Questions**: Editable list with drag-to-reorder, per-question edit/delete.
- **Preview**: Interactive respondent-facing survey (with live branching logic).
- **Flow**: xyflow diagram showing question connections and branching paths.

**Inline Question Editor** (per question):
- Edit question text, type, options, required flag.
- Full branching condition editor (see [Branching Logic](#12-branching--skip-logic)).
- Move up/down buttons.

**Action Buttons**:

| Button | What it Does |
|---|---|
| Regenerate | Re-calls Gemini with a feedback prompt requesting different questions |
| Add Question | Appends a blank question to the list |
| Quality Report | Opens evaluation overlay showing LLM scores, variable relevance, issues |
| Approve Draft | Marks questions as approved, unlocks Step 4 |

**Auto-generation** uses the same `useRef` guard as Step 2 to prevent duplicate calls.

**On Approve**: Stored in `SurveyContext`:
```js
questionsState: {
  questions: [...],
  status: "Questions Approved (v1)",
  approvedVersion: 1
}
```

---

### Step 4 — Quality Audit

**Purpose**: Review and resolve question quality issues before finalizing.

**Inputs**: Uses questions and evaluations already in `SurveyContext` (set during generation).

**Evaluation Metrics** (per question):

| Metric | Source | Range | Description |
|---|---|---|---|
| Relevance | Gemini LLM | 1–5 | How relevant to the survey topic |
| Clarity | Gemini LLM | 1–5 | How easy to understand |
| Neutrality | Gemini LLM | 1–5 | Freedom from bias or leading language |
| Answerability | Gemini LLM | 1–5 | How easy for respondents to answer |
| Variable Match | Local embeddings | 0–1 (%) | Cosine similarity to assigned variable |
| Readability | Flesch formula | 0–100 | Reading ease score |
| Duplicate Risk | Local embeddings | 0–1 | Highest similarity to any other question |
| Rule Violations | Rule checks | List | See below |

**Rule Violations Detected**:

| Violation | Detection |
|---|---|
| `multiple_questions` | More than one `?` in the question |
| `too_long` | Question exceeds 40 words |
| `double_negative` | Two negation words within 4-word window |
| `vague_language` | Words like "often", "usually", "many", "some" |
| `leading_language` | Phrases like "would you agree", "obviously", "don't you think" |

**Response Option Checks**:

| Check | Description |
|---|---|
| `duplicate_options` | Two options with same text |
| `yes_no_mixed_with_other_choices` | Yes/No mixed with other options |
| `only_one_option` | Question has only one answer option |

**Actions**:
- **Regenerate Poor Questions**: Re-calls Gemini with a detailed feedback prompt listing all issues.
- **Per-question Regenerate**: Targets specific failing questions.
- After regeneration → navigates back to Step 3 to review.
- **Complete Check**: Advances to Step 5.

**Quality Score** (0–100):
```
Per question: (relevance + clarity + neutrality + answerability) × 25%
Penalties: -10 for high duplicates, -5 per rule violation
Overall: average across all questions, capped 0–100
```

---

### Step 5 — Simulation (Stub)

Placeholder for statistical simulation (response distribution modeling). UI scaffold only — not yet implemented.

---

### Step 6 — Preview & Export (Stub)

Placeholder for full survey preview and export (JSON, CSV, PDF). UI scaffold only — not yet implemented.

---

### Step 8 — Dashboard (Stub)

Placeholder for response analytics dashboard with mock metrics (Total Responses, Average Satisfaction, Top Driver). Not yet implemented.

---

## 7. API Reference

All endpoints are served on `http://localhost:4000`. The Vite dev server proxies `/api/*` so the client uses relative paths.

---

### `POST /api/variable-model`

Generates a structured variable model from survey metadata.

**Request Body**:
```json
{
  "title": "Healthcare Satisfaction Survey",
  "goal": "Identify key drivers of dissatisfaction",
  "population": "RAK Residents (18+)",
  "tone": "Neutral / Government",
  "maxQuestions": 10
}
```

**Response**:
```json
{
  "dependent": ["Overall Healthcare Satisfaction"],
  "drivers": ["Wait Time", "Staff Communication", "Facility Cleanliness"],
  "controls": ["Age", "Gender", "District"]
}
```

**Fallback**: Returns `FALLBACK_VARIABLE_MODEL` from `shared/demoData.js` on error.

---

### `POST /api/generate-questions`

Generates a validated question set from the variable model.

**Request Body**:
```json
{
  "surveyDraft": { "title": "...", "goal": "...", "tone": "...", "maxQuestions": 10 },
  "variableModel": { "dependent": [...], "drivers": [...], "controls": [...] },
  "previousQuestions": null
}
```

**Response**:
```json
{
  "questions": [
    {
      "id": "q1",
      "text": "What is your gender?",
      "type": "multiple_choice",
      "variable": "Gender",
      "variableRole": "control",
      "options": ["Male", "Female", "Prefer not to say"],
      "required": true,
      "branchFrom": null,
      "branchCondition": null
    }
  ]
}
```

**Server-side validation**:
- Filters out questions missing `id`, `text`, valid `type`, or `options` array.
- Removes branch references pointing to non-existent question IDs.
- Returns `FALLBACK_QUESTIONS` if result is empty after validation.

---

### `POST /api/extract-survey-config`

Reads the text content of an uploaded file and extracts survey configuration.

**Request Body**:
```json
{ "content": "...full text of the uploaded file..." }
```

**Response**:
```json
{
  "title": "...",
  "goal": "...",
  "population": "...",
  "confidence": "95",
  "margin": "5",
  "language": ["English"],
  "tone": "Neutral / Government",
  "maxQuestions": 10
}
```

---

### `POST /api/evaluate-questions`

Runs the full quality evaluation pipeline on a set of questions.

**Request Body**:
```json
{
  "questions": [ { "id": "q1", "text": "...", "type": "...", "variable": "...", "variableRole": "..." } ],
  "topic": "Healthcare Satisfaction"
}
```

**Response**:
```json
{
  "evaluations": [
    {
      "question": "How satisfied are you?",
      "variable": "Overall Satisfaction",
      "variableRole": "dependent",
      "variable_relevance": 0.82,
      "readability": 74.5,
      "max_duplicate_similarity": 0.31,
      "llm_scores": { "clarity": 5, "neutrality": 4, "answerability": 5, "relevance": 5 },
      "rule_violations": [],
      "response_option_issues": [],
      "skip_logic_issue": null,
      "response_scale_issue": null
    }
  ]
}
```

---

### `POST /api/chat`

Conversational endpoint for the AI chat assistant.

**Request Body**:
```json
{
  "message": "Make the questions simpler",
  "action": "chat",
  "context": {
    "currentStep": 3,
    "surveyDraft": { ... },
    "variableModel": { ... },
    "questions": [ ... ],
    "evaluations": [ ... ]
  },
  "conversationHistory": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

**Intent Detection** (server-side regex):

| Intent | Pattern Examples | Action |
|---|---|---|
| Add questions | "add 3 questions", "create a new question" | Gemini generates N questions and appends |
| Remove questions | "remove the last question", "delete 2 questions" | Removes from first/last/middle by position |
| Edit/improve | "simpler", "shorter", "reword", "improve" | Gemini regenerates with feedback |
| Explicit regen | `action: "regenerate_questions"` | Regenerates entire set with feedback |

**Response (question modification)**:
```json
{
  "message": "I've added 2 the questions. Here are the updated questions.",
  "action": "questions_regenerated",
  "regeneratedQuestions": [ ... ]
}
```

**Response (chat)**:
```json
{
  "message": "Here's my suggestion for improving...",
  "action": "chat"
}
```

---

## 8. AI & Prompt System

All prompts live in `shared/promptTemplates.js` and are imported by the server.

### Variable Model Prompt

**System**: Instructs Gemini to act as a research methodology expert. Requires output as a JSON object with three arrays: `dependent`, `drivers`, `controls`.

**User Prompt** includes: survey title, goal, target population, tone, max questions, languages.

### Survey Config Extraction Prompt

**System**: Instructs Gemini to parse free-form text and extract structured survey fields.

**User Prompt**: Raw text from uploaded file.

### Question Generation Prompt

**System** (most detailed): Comprehensive rules covering:
- Question ordering: controls (demographics) first, then dependent outcome, then drivers.
- All questions must map to a specific variable from the model.
- Supported types: `likert`, `multiple_choice`, `multi_select`, `yes_no`, `open_ended`, `rating`.
- Branching logic rules (no self-reference, parent must appear before child).
- Output must be strict JSON: `{ "questions": [...] }`.

**User Prompt** includes: full survey config, variable model (all three categories), max questions, language, tone, and optionally a feedback string for regeneration.

### Chat System Prompt

Contextual prompt that includes the AI's role as a survey design assistant, the current workflow step, survey title and goal, number of questions, and any evaluation issues.

### Gemini Call Wrapper (`callGemini`)

```
Input prompt
     │
     ▼
Gemini API
     │
     ▼
Strip markdown code fences (```json ... ```)
     │
     ▼
JSON.parse()
    / \
  OK   Error
  │       │
  │    Retry once with "Return ONLY valid JSON" appended
  │       │
  │    JSON.parse()
  │       / \
  │     OK   Error → return fallback value
  │     │
  └─────┴──→ return parsed object
```

---

## 9. Quality Evaluation Pipeline

Lives in `server/evaluator.js`. Called from `/api/evaluate-questions`.

### Pipeline Diagram

```
Input: questions[] + topic
          │
          ├── validateSkipLogic()              → skip_logic_issue per question
          ├── checkResponseScaleConsistency()  → response_scale_issue per question
          ├── duplicateScores()                → NxN cosine similarity matrix (Xenova)
          ├── llmQualityScoreBatch()           → LLM scores for all Qs (1 Gemini call)
          │
          └── Per question loop:
               ├── variableRelevanceScore()    → cosine sim to variable description (Xenova)
               ├── readabilityScore()          → Flesch Reading Ease (0–100)
               ├── ruleViolations()            → array of detected rule issues
               └── validateResponseOptions()   → array of option problems
                        │
                        ▼
               evaluation object (one per question)
```

### Local Embedding Model

- Model: `Xenova/all-MiniLM-L6-v2` (384-dimensional sentence embeddings, runs locally)
- Loaded lazily on first use, then cached for the server session.
- Used for:
  - **Variable relevance**: embeds the question text vs. a natural-language description of the assigned variable, computes cosine similarity.
  - **Duplicate detection**: builds an N×N similarity matrix across all question texts; the maximum off-diagonal value per row is the `max_duplicate_similarity`.

### Quality Thresholds (`shared/constants.js`)

```js
{
  minLLM: 4,                       // Minimum acceptable LLM score (1-5)
  minVariableRelevance: 0.3,       // Cosine similarity for drivers/dependent
  minVariableRelevanceControl: 0.2,// Lower threshold for demographic questions
  maxDuplicate: 0.85               // Questions above this are flagged as duplicates
}
```

If any question fails any threshold, `needRegeneration()` returns `true`.

---

## 10. State Management

All state is managed via React Context. No Redux or external state library.

### `SurveyContext` — Main State Shape

```js
{
  surveyDraft: {
    title, goal, population, confidence, margin,
    language, tone, maxQuestions, sampleSize,
    draftSaved: bool
  },
  variableModel: {
    model: { dependent: [], drivers: [], controls: [] } | null,
    status: "Not generated" | "Generated" | "Variable Model Approved (vN)",
    approvedVersion: number,
    lastApprovedAt: ISO string | null
  },
  questionsState: {
    questions: Question[] | null,
    status: "Not generated" | "Generated" | "Questions Approved (vN)",
    approvedVersion: number,
    lastApprovedAt: ISO string | null
  },
  stepStatus: {
    1: "unlocked",
    2: "locked" | "unlocked" | "completed",
    3: "locked" | "unlocked" | "completed",
    4: "locked" | "unlocked" | "completed",
    5: "locked" | "unlocked",
    6: "locked",
    7: "locked",
    8: "unlocked"
  },
  evaluations: Evaluation[]
}
```

### Step Unlock Sequence

```
saveSurveyDraft()      → Step 1: completed, Step 2: unlocked
                          + clears variableModel, questionsState, evaluations
                          + relocks Steps 3–7

approveVariableModel() → Step 2: completed, Step 3: unlocked

approveQuestions()     → Step 3: completed, Step 4: unlocked

completeQualityCheck() → Step 4: completed, Step 5: unlocked
```

### Persistence

The entire state object is serialized to `localStorage` (key: `dynamicSurveyDemoState`) after every state change. On load, state is initialized **synchronously** from `localStorage` via lazy `useState` initializers — this prevents auto-generation effects from firing before stored state is available.

---

### `ChatContext` — Chat State

```js
{
  messages: [{ role: "user"|"assistant", content: string }],
  isLoading: bool,
  conversationContext: { currentStep, activeQuestionId, regenerationAttempt }
}
```

When the chat returns `action: "questions_regenerated"`, the context automatically calls `updateQuestions()` in `SurveyContext` to replace the question list.

---

## 11. Chat Assistant

The chat sidebar is available on all pages. It connects to `/api/chat` and maintains a sliding 10-message conversation history.

**Supported Natural Language Operations**:

| User says | What happens |
|---|---|
| "Add 2 more questions" | Gemini generates 2 new questions, appended to list |
| "Remove the last question" | Last question removed from state |
| "Remove the first 3 questions" | First 3 removed |
| "Make the questions simpler" | Gemini regenerates all with simplification feedback |
| "Reword question 3" | Gemini regenerates with targeted feedback |
| Regenerate button | Explicit regeneration with full conversation context |

The server detects intent with regex patterns before calling Gemini. If no modification intent is detected, it routes to a standard Gemini chat response.

---

## 12. Branching / Skip Logic

Each question can optionally be shown conditionally based on a previous question's answer.

**Branch Fields on a Question**:
```js
{
  branchFrom: "q2",
  branchCondition: {
    questionId: "q2",
    operator: "equals",    // equals | not_equals | includes | gte | lte
    value: "Yes"           // string, string[], or numeric string
  }
}
```

**Operators**:

| Operator | Use Case |
|---|---|
| `equals` | Single answer must match exactly |
| `not_equals` | Single answer must not match |
| `includes` | Answer must be one of multiple values |
| `gte` | Numeric answer must be ≥ value |
| `lte` | Numeric answer must be ≤ value |

**Live Preview** (Step 3 Preview tab): `getVisibleQuestions(questions, answers)` filters the full question list to only those whose branch conditions are satisfied by the current respondent answers.

**Server Validation**: During question generation, branch references pointing to non-existent question IDs are stripped before returning the response.

**Visual**: The Flow tab in Step 3 renders a xyflow diagram where each question is a node and branching conditions are directed labeled edges.

---

## 13. Data Persistence

**Key**: `dynamicSurveyDemoState` in `localStorage`.

**What is saved**: survey draft, variable model, questions, evaluations, step lock status.

**When saved**: A `useEffect` in `SurveyContext` re-serializes state to `localStorage` after every state change.

**Reset**: "Reset Demo Data" button in the header calls `resetDemoData()` — clears `localStorage` and resets all context state to defaults.

**Lazy init**: All `useState` calls in `SurveyContext` use lazy initializers (`useState(() => loadInitialState().x)`) so `localStorage` is read synchronously before the first render. This prevents a race where auto-generation effects would fire before stored state was available.

---

## 14. Shared Modules

### `shared/promptTemplates.js`

| Export | Purpose |
|---|---|
| `VARIABLE_MODEL_SYSTEM_PROMPT` | System role for variable model generation |
| `buildVariableModelUserPrompt(input)` | Fills template with survey config |
| `SURVEY_CONFIG_SYSTEM_PROMPT` | System role for config extraction |
| `buildSurveyConfigUserPrompt(text)` | Fills template with file text |
| `QUESTION_GEN_SYSTEM_PROMPT` | System role for question generation (most detailed) |
| `buildQuestionGenUserPrompt(draft, model, prev)` | Fills template with full survey context |
| `buildChatSystemPrompt(context)` | Contextual chat role prompt |
| `buildAddQuestionsUserPrompt(draft, model, questions, count)` | Adds N questions |
| `buildRegenerationFeedbackPrompt(message, evaluations)` | Feedback for targeted regeneration |

### `shared/demoData.js`

| Export | Description |
|---|---|
| `HEALTHCARE_EXAMPLE_SURVEY` | Pre-filled RAK healthcare survey config |
| `FALLBACK_VARIABLE_MODEL` | Default variable model (dependent + drivers + controls) |
| `FALLBACK_QUESTIONS` | 10 pre-written questions with one branching example |

### `shared/constants.js`

| Constant | Value | Description |
|---|---|---|
| `QUALITY_THRESHOLDS.minLLM` | 4 | Min LLM score per metric (1–5) |
| `QUALITY_THRESHOLDS.minVariableRelevance` | 0.3 | Min cosine similarity (drivers/dependent) |
| `QUALITY_THRESHOLDS.minVariableRelevanceControl` | 0.2 | Min cosine similarity (controls) |
| `QUALITY_THRESHOLDS.maxDuplicate` | 0.85 | Max allowed similarity between questions |

---

## Full Data Flow Summary

```
User fills Step 1 form
        │
        ▼
[Client] saveSurveyDraft()
  → clears downstream state, unlocks Step 2
  → navigates to Step 2 with autoGenerate flag
        │
        ▼
[Client → Server] POST /api/variable-model
        │
        ▼
[Server] Gemini generates → JSON validated → returned
        │
        ▼
[Client] setVariableModelFromAI() → stored in SurveyContext
        │
        ▼
User reviews/edits variable model, clicks Next
        │
        ▼
[Client → Server] POST /api/generate-questions
        │
        ▼
[Server] Gemini generates → questions validated & branch refs sanitized → returned
        │
        ▼
[Client] setQuestionsFromAI() → stored in SurveyContext
        │
        ▼
User reviews/edits questions, clicks Approve Draft
        │
        ▼
[Client] approveQuestions() → unlocks Step 4
        │
        ▼
Step 4 shows evaluations (user clicks Quality Report in Step 3
        to trigger /api/evaluate-questions on demand)
        │
        ▼
[Client] completeQualityCheck() → unlocks Step 5
```
