import React, { createContext, useContext } from "react";

const StepNavContext = createContext("/step");

export function StepNavProvider({ base, children }) {
  return <StepNavContext.Provider value={base}>{children}</StepNavContext.Provider>;
}

export function useStepBase() {
  return useContext(StepNavContext);
}
