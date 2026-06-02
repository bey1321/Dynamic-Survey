import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import LayoutClean from "./components/layout/LayoutClean";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Step1CreateSurvey from "./pages/Step1CreateSurvey";
import Step2VariableModel from "./pages/Step2VariableModel";
import Step3Questions from "./pages/Step3Questions";
import MySurveysPage from "./pages/MySurveysPage";
import SharedSurveyPage from "./pages/SharedSurveyPage";
import { useAuth } from "./state/AuthContext";

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (navEntry?.type === "reload" && window.location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/my-surveys"
        element={
          <PrivateRoute>
            <MySurveysPage />
          </PrivateRoute>
        }
      />

      {/* Original layout with sidebar stepper */}
      <Route
        path="/step/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="1-create" element={<Step1CreateSurvey />} />
                <Route path="2-variables" element={<Step2VariableModel />} />
                <Route path="3-questions" element={<Step3Questions />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Clean layout with horizontal stepper (same step pages, no sidebar) */}
      <Route
        path="/survey/step/*"
        element={
          <PrivateRoute>
            <LayoutClean>
              <Routes>
                <Route path="1-create" element={<Step1CreateSurvey />} />
                <Route path="2-variables" element={<Step2VariableModel />} />
                <Route path="3-questions" element={<Step3Questions />} />
              </Routes>
            </LayoutClean>
          </PrivateRoute>
        }
      />

      {/* Public shared survey viewer — no auth required */}
      <Route path="/shared/:token" element={<SharedSurveyPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

