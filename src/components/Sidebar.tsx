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
  show: boolean;
}

export function Sidebar({ onClose, width, show }: SidebarProps) {
  return (
    <div
      className={cn("flex shrink-0 overflow-hidden", "transition-[width] duration-300 ease-in-out")}
      style={{ width: show ? width : 0 }}
    >
      <aside
        className={cn(
          "flex shrink-0 h-full flex-col gap-4 border-r border-border bg-card p-4 transition-transform duration-300 ease-in-out",
          show ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ width }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Presenter</span>
          <button
            onClick={onClose}
            aria-label="Ocultar sidebar"
            title="Ocultar sidebar (Z)"
            className="size-7 rounded-md hover:bg-accent transition-colors flex items-center justify-center cursor-pointer"
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
