# Dynamic Survey

An AI-assisted survey creation tool that generates variable models and question sets using the Gemini API. Supports multilingual surveys (including Arabic) with a step-by-step creation flow.

## Project Structure

```
dynamic-survey/
├── client/      # React + Vite frontend (port 5173 in dev)
├── server/      # Express API server (port 4000)
└── shared/      # Constants and demo data shared by both
```

## Local Development

### Prerequisites

- Node.js 20.6+
- A [Gemini API key](https://aistudio.google.com/app/apikey)

### Setup

```bash
# Install all dependencies
npm run install:all

# Create the server environment file
cp server/.env.example server/.env   # then fill in your key
```

Add your key to `server/.env`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
```

### Run

```bash
npm run dev
```

This starts both the client (http://localhost:5173) and the API server (http://localhost:4000) concurrently.

---

## Docker

The Docker image builds the React client at image-build time and serves everything from the single Express server on **port 4000**.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running

### Build

```bash
docker build -t dynamic-survey .
```

This runs a two-stage build: the first stage compiles the React app with Vite, and the second stage assembles the production server image with the compiled assets.

### Run

```bash
docker run -p 4000:4000 \
  -e GEMINI_API_KEY=your_key_here \
  -e GEMINI_MODEL=gemini-2.0-flash \
  dynamic-survey
```

Then open **http://localhost:4000** in your browser.

**Never pass your API key in a `.env` file inside the image.** Use `-e` flags or Docker's `--env-file` option at run time:

```bash
# Using a local env file (keep it out of version control)
docker run -p 4000:4000 --env-file .env.docker dynamic-survey
```

Where `.env.docker` contains:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
NODE_ENV=production
```

### Optional: Custom Port

```bash
docker run -p 8080:4000 -e GEMINI_API_KEY=your_key_here dynamic-survey
# Now available at http://localhost:8080
```

---

## Environment Variables

| Variable          | Required | Default              | Description                        |
|-------------------|----------|----------------------|------------------------------------|
| `GEMINI_API_KEY`  | Yes      | —                    | Google Gemini API key              |
| `GEMINI_MODEL`    | No       | `gemini-2.0-flash`   | Gemini model to use                |
| `PORT`            | No       | `4000`               | Port the server listens on         |
| `NODE_ENV`        | No       | —                    | Set to `production` in Docker      |
