## Dynamic Survey Prototype

Demo-ready web prototype for the **Dynamic Survey Prototype — Step-by-Step Architecture + UI**.

### Stack

- **Frontend**: React + Vite (JavaScript) + TailwindCSS + React Router
- **Backend**: Node + Express
- **Styling**: TailwindCSS
- **Shared**: Prompt templates and demo data in `shared/`

### Install

From the project root:

```bash
npm install
```

This will install root dependencies and run installation for both `client` and `server`.

### Environment

Optionally set a Gemini API key (for live variable model generation):

On Windows PowerShell:

```bash
$env:GEMINI_API_KEY = "your_api_key_here"
```

Or via a `.env` file in the `server` folder:

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-pro
```

If `GEMINI_API_KEY` is not provided, the server returns a safe fallback demo variable model that matches the specification.

### Run (dev)

From the project root:

```bash
npm run dev
```

This starts:

- Express API server on `http://localhost:4000`
- Vite dev server + React app on `http://localhost:5173`

### Notes

- Routes:
  - `/step/1-create`
  - `/step/2-variables`
  - `/step/3-questions`
  - `/step/4-audit`
  - `/step/5-simulation`
  - `/step/6-preview`
  - `/step/7-respondent`
  - `/step/8-dashboard`
- Default route redirects to `/step/1-create`.
- Local state and `localStorage` store the survey draft, variable model, and step statuses.
- **Reset Demo Data** in the top header clears `localStorage` and resets the demo state.

