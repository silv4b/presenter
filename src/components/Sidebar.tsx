import { Separator } from "@/components/ui/separator";
import { Timer } from "@/components/Timer";
import { FileControls } from "@/components/sidebar/FileControls";
import { MonitorSelector } from "@/components/sidebar/MonitorSelector";
import { PresentationControls } from "@/components/sidebar/PresentationControls";
import { SlideNavigation } from "@/components/sidebar/SlideNavigation";
import { AnnotationToolbar } from "@/components/sidebar/AnnotationToolbar";
import { PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onClose: () => void;
  width: number;
}

export function Sidebar({ onClose, width }: SidebarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 overflow-hidden",
        "transition-[width] duration-300 ease-in-out",
      )}
      style={{ width: width + 6 }}
    >
      <aside
        className="flex h-full flex-col gap-4 border-r border-border bg-card p-4"
        style={{ width }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Presenter</span>
          <button
            onClick={onClose}
            aria-label="Ocultar sidebar"
            title="Ocultar sidebar (B)"
            className="size-7 rounded-md hover:bg-accent transition-colors"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

      <FileControls />
      <Separator />
      <MonitorSelector />
      <Separator />
      <PresentationControls />
      <Separator />
      <SlideNavigation />

      <div className="mt-auto flex flex-col gap-3">
        <AnnotationToolbar />
        <Timer />
      </div>
    </aside>
  </div>
);
}
