import { Document, Page } from "@/lib/pdf";
import { cn } from "@/lib/utils";

interface NextPreviewProps {
  file: string;
  pageNumber: number;
  width?: number;
  className?: string;
}

export function NextPreview({
  file,
  pageNumber,
  width = 352,
  className,
}: NextPreviewProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="overflow-hidden rounded-lg border border-border">
        <Document file={file} suspense={false} loading={null} error={null}>
          <Page
            pageNumber={pageNumber}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={null}
          />
        </Document>
      </div>
    </div>
  );
}
