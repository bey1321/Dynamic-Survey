import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { SurveyProvider } from "./state/SurveyContext";
import { ToastProvider } from "./state/ToastContext";
import { ChatProvider } from "./state/ChatContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ToastProvider>
      <ChatProvider>
        <SurveyProvider>
          <App />
        </SurveyProvider>
      </ChatProvider>
    </ToastProvider>
  </BrowserRouter>
);

