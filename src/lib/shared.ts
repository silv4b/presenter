import { emit as emitEvent } from "@tauri-apps/api/event";

export const VIEWSCREEN_PREFIX = "viewscreen";

export const EVENT_SLIDE_CHANGE = "mudar-slide";
// O zoom é local das janelas (cada PdfStage aplica o próprio); quando muda,
// o presenter reenvia para a projeção acompanhar.
export const EVENT_ZOOM_CHANGE = "mudar-zoom";
export const EVENT_BLACK_SCREEN = "tela-preta";
export const EVENT_WHITE_SCREEN = "tela-branca";
// Emitida pela projeção assim que ela registra os listeners. O presenter só
// reenvia slide/preto/branco depois desse sinal, senão o primeiro estado se perde.
export const EVENT_VIEWSCREEN_READY = "projecao-pronta";
// A janela principal avisa o App antes de sair para que o PDF aberto possa
// pedir confirmação de vez.
export const EVENT_APP_CLOSE_REQUESTED = "app-close-requested";

export interface SlideChangePayload {
  page: number;
}

export interface DocumentInfo {
  path: string;
  name: string;
  page: number;
}

/**
 * Emite um evento sem deixar a falha escapar.
 *
 * Nenhuma sincronizacao com a projecao pode derrubar o fluxo da apresentacao:
 * se o `emit` falha, o certo e seguir e deixar rastro no console. Emitir nao
 * muda o estado local, entao um erro aqui sempre significa problema de
 * verdade, ainda que o caminho seja de limpeza (que antes era silenciado por
 * acaso).
 */
export function emitSafe(event: string, payload?: unknown): Promise<void> {
  return emitEvent(event, payload).catch((e) => {
    console.error("Falha ao emitir " + event, e);
  });
}
