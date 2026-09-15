import { Separator } from "@/components/ui/separator";
import { Timer } from "@/components/Timer";
import { FileControls } from "@/components/sidebar/FileControls";
import { MonitorSelector } from "@/components/sidebar/MonitorSelector";
import { PresentationControls } from "@/components/sidebar/PresentationControls";
import { SlideNavigation } from "@/components/sidebar/SlideNavigation";
import { AnnotationToolbar } from "@/components/sidebar/AnnotationToolbar";

export function Sidebar() {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-4 border-r border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Presenter</span>
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
  );
}
