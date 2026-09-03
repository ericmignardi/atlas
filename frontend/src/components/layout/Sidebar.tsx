import { NavLink } from "react-router";

import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ProjectSummary } from "@/types/api";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** FR-7.6: `1`–`5` jump to a nav section, in this order. */
  shortcut: string;
  count?: number;
  /** Overdue tasks read as a red pill rather than a grey one (PRD §9.1). */
  countTone?: "muted" | "urgent";
}

export interface SidebarCounts {
  projects?: number;
  overdueTasks?: number;
  environments?: number;
  tags?: number;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  counts?: SidebarCounts;
  /** FR-6.2: up to four, shown under the divider. */
  pinnedProjects?: ProjectSummary[];
}

/**
 * PRD §9.1. 248 px expanded, 60 px collapsed, Settings pinned to the bottom.
 *
 * The counts are props rather than fetched here. A navigation component that
 * issues its own requests is a navigation component that refetches on every
 * route change and cannot be rendered in a test without a server.
 */
export const Sidebar = ({
  collapsed,
  onToggle,
  counts = {},
  pinnedProjects = [],
}: SidebarProps) => {
  const items: NavItem[] = [
    { to: "/", label: "Dashboard", icon: "dashboard", shortcut: "1" },
    { to: "/projects", label: "Projects", icon: "projects", shortcut: "2", count: counts.projects },
    {
      to: "/tasks",
      label: "Tasks",
      icon: "tasks",
      shortcut: "3",
      count: counts.overdueTasks,
      countTone: "urgent",
    },
    {
      to: "/environments",
      label: "Environments",
      icon: "environments",
      shortcut: "4",
      count: counts.environments,
    },
    { to: "/tags", label: "Tags", icon: "tags", shortcut: "5", count: counts.tags },
  ];

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line bg-surface",
        "transition-[width] duration-200 ease-enter",
        collapsed ? "w-[60px]" : "w-[248px]",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-line",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {!collapsed && <span className="text-lg tracking-tight text-ink">Atlas</span>}
        <IconButton
          icon={collapsed ? "expand" : "collapse"}
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          size="sm"
          onClick={onToggle}
        />
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <ul className="flex flex-col gap-0.5 px-2">
          {items.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>

        {pinnedProjects.length > 0 && (
          <>
            <hr className="my-3 border-line" />
            {!collapsed && (
              <p className="px-4 pb-1.5 text-eyebrow uppercase text-ink-muted">Pinned</p>
            )}
            <ul className="flex flex-col gap-0.5 px-2">
              {pinnedProjects.slice(0, 4).map((project) => (
                <li key={project.id}>
                  <SidebarLink
                    item={{
                      to: `/projects/${project.slug}`,
                      label: project.name,
                      icon: "pin",
                      shortcut: "",
                    }}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-2">
        <SidebarLink
          item={{ to: "/settings", label: "Settings", icon: "settings", shortcut: "" }}
          collapsed={collapsed}
        />
      </div>
    </nav>
  );
};

const SidebarLink = ({ item, collapsed }: { item: NavItem; collapsed: boolean }) => {
  const link = (
    <NavLink
      to={item.to}
      // `end` only on the dashboard: without it "/" matches every route and the
      // whole sidebar lights up at once.
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          "group flex h-9 items-center rounded-md text-sm transition-colors duration-150 ease-enter",
          collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
          isActive
            ? "bg-tint-blue text-accent"
            : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
        )
      }
    >
      <Icon name={item.icon} size={17} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.count !== undefined && item.count > 0 && <NavCount item={item} />}
        </>
      )}
    </NavLink>
  );

  // Collapsed to 60 px there is no label, so the tooltip is the only thing
  // naming the destination for a sighted mouse user (the link text is still
  // there for assistive technology).
  return collapsed ? (
    <Tooltip label={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
};

const NavCount = ({ item }: { item: NavItem }) => (
  <span
    className={cn(
      "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
      item.countTone === "urgent"
        ? "bg-tint-red text-tint-red-ink"
        : "bg-tint-neutral text-ink-muted",
    )}
  >
    {item.count}
  </span>
);
