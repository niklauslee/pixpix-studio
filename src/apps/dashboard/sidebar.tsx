import { ImageIcon, LayersIcon, MonitorIcon, TypeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardView = "scenes" | "fonts" | "icons" | "sprites";

interface SidebarProps {
  active: DashboardView;
  onChange: (view: DashboardView) => void;
}

const ITEMS: {
  id: DashboardView;
  label: string;
  icon: typeof MonitorIcon;
}[] = [
  { id: "scenes", label: "Scenes", icon: MonitorIcon },
  { id: "fonts", label: "Fonts", icon: TypeIcon },
  { id: "icons", label: "Icon Sets", icon: ImageIcon },
  { id: "sprites", label: "Sprite Sets", icon: LayersIcon },
];

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="flex w-48 shrink-0 flex-col border-r-[1.5px] border-neutral-700 py-3">
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "flex cursor-pointer items-center gap-2 border-l-2 px-4 py-2 text-left text-xs transition-colors",
            active === id
              ? "border-green-600 bg-muted text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="flex-1">{label}</span>
        </button>
      ))}
    </aside>
  );
}
