import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import LayoutClean from "./components/LayoutClean";
import HomePage from "./pages/HomePage";
import Step1CreateSurvey from "./pages/Step1CreateSurvey";
import Step2VariableModel from "./pages/Step2VariableModel";
import Step3Questions from "./pages/Step3Questions";
import Step4Audit from "./pages/Step4Audit";
import Step5Simulation from "./pages/Step5Simulation";
import Step6Preview from "./pages/Step6Preview";
import Step8Dashboard from "./pages/Step8Dashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      {/* Original layout with sidebar stepper */}
      <Route
        path="/step/*"
        element={
          <Layout>
            <Routes>
              <Route path="1-create" element={<Step1CreateSurvey />} />
              <Route path="2-variables" element={<Step2VariableModel />} />
              <Route path="3-questions" element={<Step3Questions />} />
              <Route path="4-audit" element={<Step4Audit />} />
              <Route path="5-simulation" element={<Step5Simulation />} />
              <Route path="6-preview" element={<Step6Preview />} />
              <Route path="8-dashboard" element={<Step8Dashboard />} />
            </Routes>
          </Layout>
        }
      />

      {/* Clean layout with horizontal stepper (same step pages, no sidebar) */}
      <Route
        path="/survey/step/*"
        element={
          <LayoutClean>
            <Routes>
              <Route path="1-create" element={<Step1CreateSurvey />} />
              <Route path="2-variables" element={<Step2VariableModel />} />
              <Route path="3-questions" element={<Step3Questions />} />
              <Route path="4-audit" element={<Step4Audit />} />
              <Route path="5-simulation" element={<Step5Simulation />} />
              <Route path="6-preview" element={<Step6Preview />} />
              <Route path="8-dashboard" element={<Step8Dashboard />} />
            </Routes>
          </LayoutClean>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

