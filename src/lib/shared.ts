export const VIEWSCREEN_LABEL = "viewscreen";

export const EVENT_SLIDE_CHANGE = "mudar-slide";
export const EVENT_BLACK_SCREEN = "tela-preta";

export interface SlideChangePayload {
  page: number;
}

export interface DocumentInfo {
  path: string;
  name: string;
  page: number;
}
