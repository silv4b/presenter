import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import Viewscreen from "./viewscreen/Viewscreen";
import "./index.css";

const appWindow = getCurrentWindow();
const isViewscreen = appWindow.label.startsWith("viewscreen");

if (!isViewscreen) {
  appWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    await emit("app-close-requested");
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={300}>
      {isViewscreen ? <Viewscreen /> : <App />}
    </TooltipProvider>
  </React.StrictMode>,
);
