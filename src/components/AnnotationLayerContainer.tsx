import { useCallback } from "react";
import { usePresentation } from "@/state/presentation";
import { usePresenterAnnotations } from "@/state/annotations";
import { AnnotationLayer } from "./AnnotationLayer";

interface AnnotationLayerContainerProps {
  scale: number;
  interactive?: boolean;
  annotationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function AnnotationLayerContainer({
  scale,
  interactive = true,
  annotationCanvasRef,
}: AnnotationLayerContainerProps) {
  const { activeTool, currentPage } = usePresentation();
  const {
    strokes,
    laser,
    penSize,
    highlighterSize,
    eraserRadius,
    penColor,
    highlighterColor,
    onStrokeStart,
    onStrokePoint,
    onStrokeEnd,
    onLaser,
    onEraseStart,
    onErasePoint,
    onEraseEnd,
    clearPage,
    adjustSize,
  } = usePresenterAnnotations();

  const onEraseAll = useCallback(() => {
    clearPage(currentPage);
  }, [clearPage, currentPage]);

  return (
    <AnnotationLayer
      scale={scale}
      activeTool={activeTool}
      interactive={interactive}
      strokes={strokes}
      laser={laser}
      onStrokeStart={onStrokeStart}
      onStrokePoint={onStrokePoint}
      onStrokeEnd={onStrokeEnd}
      onLaser={onLaser}
      onEraseStart={onEraseStart}
      onErasePoint={onErasePoint}
      onEraseEnd={onEraseEnd}
      onEraseAll={onEraseAll}
      eraserRadius={eraserRadius}
      penSize={penSize}
      highlighterSize={highlighterSize}
      penColor={penColor}
      highlighterColor={highlighterColor}
      onResize={adjustSize}
      annotationCanvasRef={annotationCanvasRef}
    />
  );
}
