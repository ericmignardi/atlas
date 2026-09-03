import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Database,
  ExternalLink,
  Filter,
  FolderKanban,
  GitBranch,
  Inbox,
  Info,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  List,
  ListChecks,
  Loader2,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Tags,
  Trash2,
  Unlink,
  User,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * A fixed allowlist. Lucide ships fifteen hundred icons; importing it freely
 * means the icon set stops being a system within a week, and every unused one
 * is bundle weight (NFR-1.3). Adding an icon is a deliberate edit to this map,
 * which is exactly the amount of friction the decision deserves.
 */
const ICONS = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  tasks: ListChecks,
  environments: Server,
  tags: Tags,
  settings: Settings,

  search: Search,
  filter: Filter,
  plus: Plus,
  close: X,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  back: ArrowLeft,
  more: MoreHorizontal,

  collapse: PanelLeftClose,
  expand: PanelLeftOpen,
  grid: LayoutGrid,
  list: List,

  pin: Pin,
  unpin: PinOff,
  edit: Pencil,
  delete: Trash2,
  external: ExternalLink,
  branch: GitBranch,
  database: Database,
  link: Link2,
  unlink: Unlink,
  calendar: Calendar,
  circle: Circle,

  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
  spinner: Loader2,
  empty: Inbox,
  retry: RefreshCw,
  signOut: LogOut,
  user: User,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  /** Pixels. 14 sits with text-sm, 16 with text-base, 18 in nav rows. */
  size?: number;
  className?: string;
  /**
   * Icons are decorative by default and hidden from assistive technology — the
   * label beside them already says what they mean. Pass a label only when the
   * icon is the entire content of a control that has no other text.
   */
  label?: string;
}

export const Icon = ({ name, size = 16, className, label }: IconProps) => {
  const Glyph = ICONS[name];
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={1.75}
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
};
