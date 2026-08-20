import { LayoutDashboardIcon } from "lucide-react";
import Logo from "@/components/logo";
import { cn } from "@/lib/utils";

/** Which page is currently open — shown as a label, not a link. */
export type AppbarApp = "scene" | "font" | "icon" | "sprite" | "dashboard";

const APP_LABELS: Record<AppbarApp, string> = {
  scene: "Scene",
  font: "Font",
  icon: "Icon",
  sprite: "Sprite",
  dashboard: "Dashboard",
};

/** Maps the current app to the dashboard tab it should link back to. */
const DASHBOARD_VIEW: Partial<Record<AppbarApp, string>> = {
  scene: "scenes",
  font: "fonts",
  icon: "icons",
  sprite: "sprites",
};

interface AppbarProps extends React.HTMLAttributes<HTMLDivElement> {
  active: AppbarApp;
  /** App-specific actions, right-aligned. */
  children?: React.ReactNode;
}

/**
 * The titlebar shared by all pages: logo, the current page label, and a slot
 * for app-specific actions.
 */
export function Appbar({
  active,
  className,
  children,
  ...others
}: AppbarProps) {
  return (
    <div
      className={cn(
        "flex h-12 w-full shrink-0 items-center justify-between border-b-[1.5px] border-neutral-700",
        className,
      )}
      {...others}
    >
      <div className="flex items-center justify-start gap-6 px-4">
        <div className="text-xl flex flex-row items-start justify-center gap-1">
          <div className="text-xl ml-3">Pixpix studio</div>
        </div>
        <div className="text-sm text-muted-foreground">
          {APP_LABELS[active]}
        </div>
        {active !== "dashboard" && (
          <a
            href={`/dashboard?view=${DASHBOARD_VIEW[active]}`}
            title="Back to Dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <LayoutDashboardIcon className="size-3.5" />
            Dashboard
          </a>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 px-4">
        {children}
        <a
          href="https://github.com/niklauslee/pixpix-studio"
          target="_blank"
          rel="noopener noreferrer"
        >
          Github
        </a>
      </div>
    </div>
  );
}
