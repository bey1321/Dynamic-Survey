import React from "react";
import SidebarStepper from "./SidebarStepper";
import HeaderBar from "./HeaderBar";
import ToastContainer from "./ToastContainer";

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <HeaderBar />
      <div className="flex flex-1 max-w-6xl mx-auto w-full gap-4 px-4 py-4">
        <aside className="w-64 shrink-0">
          <SidebarStepper />
        </aside>
        <main className="flex-1">
          <div className="card p-6">{children}</div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default Layout;

