import { Document, Page } from "@/lib/pdf";

interface NextPreviewProps {
  file: string;
  pageNumber: number;
  width?: number;
}

export function NextPreview({
  file,
  pageNumber,
  width = 352,
}: NextPreviewProps) {
  return (
    <div className="flex items-center justify-center">
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
