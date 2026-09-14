import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  applyErase,
  EVENT_ANNOTATION_STROKE,
  EVENT_ANNOTATION_LASER,
  EVENT_ANNOTATION_ERASE,
  EVENT_ANNOTATION_CLEAR,
  EVENT_ANNOTATION_CLEAR_PAGE,
  EVENT_ANNOTATION_STATE_SYNC,
  type AnnotationStroke,
  type ErasePayload,
  type Point,
} from "@/lib/annotations";

export interface ViewscreenAnnotations {
  strokesByPage: Record<number, AnnotationStroke[]>;
  laser: Point | null;
}

export function useViewscreenAnnotations(): ViewscreenAnnotations {
  const [strokesByPage, setStrokesByPage] = useState<Record<number, AnnotationStroke[]>>({});
  const [laser, setLaser] = useState<Point | null>(null);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];
    const add = (p: Promise<UnlistenFn>) =>
      p.then((u) => { if (disposed) u(); else unlisteners.push(u); });

    add(
      listen<AnnotationStroke>(EVENT_ANNOTATION_STROKE, (e) => {
        const s = e.payload;
        setStrokesByPage((prev) => {
          const list = prev[s.page] ?? [];
          const idx = list.findIndex((x) => x.id === s.id);
          const updated = idx >= 0 ? list.map((x, i) => (i === idx ? s : x)) : [...list, s];
          return { ...prev, [s.page]: updated };
        });
      }),
    );

    add(
      listen<Point | null>(EVENT_ANNOTATION_LASER, (e) => {
        setLaser(e.payload);
      }),
    );

    add(
      listen<ErasePayload>(EVENT_ANNOTATION_ERASE, (e) => {
        const { page, points, radius } = e.payload;
        setStrokesByPage((prev) => applyErase(prev, page, points, radius));
      }),
    );

    add(
      listen(EVENT_ANNOTATION_CLEAR, () => {
        setStrokesByPage({});
        setLaser(null);
      }),
    );

    add(
      listen<{ page: number }>(EVENT_ANNOTATION_CLEAR_PAGE, (e) => {
        setStrokesByPage((prev) => {
          const next = { ...prev };
          delete next[e.payload.page];
          return next;
        });
      }),
    );

    add(
      listen<Record<number, AnnotationStroke[]>>(EVENT_ANNOTATION_STATE_SYNC, (e) => {
        setStrokesByPage(e.payload);
      }),
    );

    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  return { strokesByPage, laser };
}
