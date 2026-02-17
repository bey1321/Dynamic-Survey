import React from "react";
import { useToast } from "../state/ToastContext";

function ToastContainer() {
  const { toast } = useToast();

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-slate-900 text-white text-sm px-4 py-3 rounded shadow-lg max-w-xs">
        {toast.message}
      </div>
    </div>
  );
}

export default ToastContainer;

