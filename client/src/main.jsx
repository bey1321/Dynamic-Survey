import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { SurveyProvider } from "./state/SurveyContext";
import { ToastProvider } from "./state/ToastContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <SurveyProvider>
          <App />
        </SurveyProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

