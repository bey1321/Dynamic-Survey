import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Step1CreateSurvey from "./pages/Step1CreateSurvey";
import Step2VariableModel from "./pages/Step2VariableModel";
import Step3Questions from "./pages/Step3Questions";
import Step4Audit from "./pages/Step4Audit";
import Step5Simulation from "./pages/Step5Simulation";
import Step6Preview from "./pages/Step6Preview";
import Step8Dashboard from "./pages/Step8Dashboard";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/step/1-create" replace />} />
        <Route path="/step/1-create" element={<Step1CreateSurvey />} />
        <Route path="/step/2-variables" element={<Step2VariableModel />} />
        <Route path="/step/3-questions" element={<Step3Questions />} />
        <Route path="/step/4-audit" element={<Step4Audit />} />
        <Route path="/step/5-simulation" element={<Step5Simulation />} />
        <Route path="/step/6-preview" element={<Step6Preview />} />
        <Route path="/step/8-dashboard" element={<Step8Dashboard />} />
        <Route path="*" element={<Navigate to="/step/1-create" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;

