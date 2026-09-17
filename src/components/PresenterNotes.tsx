import { StickyNote } from "lucide-react";

interface PresenterNotesProps {
  notes: Record<number, string[]>;
  currentPage: number;
}

export function PresenterNotes({ notes, currentPage }: PresenterNotesProps) {
  const pageNotes = notes[currentPage];

  if (!pageNotes || pageNotes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Nenhuma nota nesta página
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {pageNotes.map((note, i) => (
        <div
          key={i}
          className="flex gap-2 rounded-md border border-border bg-muted/50 p-2.5"
        >
          <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {note}
          </p>
        </div>
      ))}
    </div>
  );
}