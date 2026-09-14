import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import Viewscreen from "./viewscreen/Viewscreen";
import "./index.css";

const isViewscreen = getCurrentWindow().label === "viewscreen";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={300}>
      {isViewscreen ? <Viewscreen /> : <App />}
    </TooltipProvider>
  </React.StrictMode>,
);
