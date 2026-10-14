import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EVENT_APP_CLOSE_REQUESTED, VIEWSCREEN_PREFIX } from "@/lib/shared";
import App from "./App";
import Viewscreen from "./viewscreen/Viewscreen";
import "./index.css";

const appWindow = getCurrentWindow();
const isViewscreen = appWindow.label.startsWith(VIEWSCREEN_PREFIX);

if (!isViewscreen) {
  // O `preventDefault` abaixo bloqueia o fechamento; se o pedido não chegar ao
  // App, a janela ficaria impossível de fechar. Melhor encerrar sem confirmação
  // do que travar o app.
  appWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    try {
      await emit(EVENT_APP_CLOSE_REQUESTED);
    } catch (e) {
      console.error("Falha ao pedir o fechamento confirmado", e);
      appWindow.destroy();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={300}>
      {isViewscreen ? <Viewscreen /> : <App />}
    </TooltipProvider>
  </React.StrictMode>,
);
