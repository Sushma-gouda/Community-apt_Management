import { Link, useRouterState, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Building2, ChevronDown, LogOut, Menu, Moon, Search, Sun, X, CheckCircle, UserCheck, XCircle, ShieldCheck, CreditCard, Wrench, ClipboardList, Info } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn, formatDisplayName } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { signOut as supabaseSignOut } from "@/services/supabase/client";

export type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function DashboardLayout({
  role,
  items,
  children,
}: {
  role: "Admin" | "Resident" | "Security";
  items: NavItem[];
  children: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { user, profile, initialized } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllRead, clearReadNotifications } = useNotifications();

  const rawDisplayName =
    profile?.full_name?.trim() || user?.user_metadata?.full_name?.trim() || user?.email?.split("@")[0]?.trim() || `${role} User`;
  const displayName = formatDisplayName(rawDisplayName, `${role} User`);
  const userEmail = user?.email ?? `${role.toLowerCase()}@communa.app`;
  const initials = (() => {
    const base = displayName.toUpperCase();
    const letters = base.replace(/[^A-Z0-9]/gi, "");
    if (letters.length >= 2) return letters.slice(0, 2);
    if (letters.length === 1) return (letters + letters).slice(0, 2);
    return role.slice(0, 2).toUpperCase();
  })();

  const handleSignOut = async () => {
    setProfileOpen(false);
    await supabaseSignOut();
    window.location.href = "/signin";
  };

  // Scroll to top on every route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [path]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [path]);

  if (!initialized || (user && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" search={{ next: path }} />;
  }

  const currentRole = profile?.role || "resident";
  if (role.toLowerCase() !== currentRole) {
    return <Navigate to={`/dashboard/${currentRole}`} />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Background mesh */}
      <div className="fixed inset-0 -z-10 gradient-mesh opacity-30 pointer-events-none" />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-72 shrink-0 transform transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="h-full m-3 lg:m-4 rounded-2xl glass-strong shadow-card flex flex-col overflow-hidden">
          {/* Logo */}
          <div className="p-5 flex items-center justify-between shrink-0">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-[image:var(--gradient-primary)] shadow-glow">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Communa</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {role}
                </div>
              </div>
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden p-1.5 rounded-md hover:bg-foreground/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {items.map((it) => {
              const active = path === it.to;
              return (
                <Link
                  key={it.to + it.label}
                  to={it.to}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200",
                    active
                      ? "bg-primary/10 text-primary font-semibold shadow-sm"
                      : "text-foreground/75 font-medium hover:text-foreground hover:bg-foreground/5",
                  )}
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  {it.label}
                </Link>
              );
            })}
          </nav>

          {/* User footer */}
          <div className="p-3 border-t border-border/50 shrink-0">
            <div className="flex items-center gap-3 p-2 rounded-xl transition hover:bg-foreground/[0.02]">
              <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center text-primary text-sm font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{displayName}</div>
                <div className="text-[11px] text-muted-foreground truncate">{userEmail}</div>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
        />
      )}

      {/* Main content area */}
      <div className="flex-1 min-w-0 lg:ml-[calc(18rem+2rem)] flex flex-col min-h-screen">
        {/* Top navbar */}
        <header className="sticky top-0 z-20 px-4 sm:px-6 lg:px-8 pt-4 lg:pt-6 shrink-0 transition-all">
          <div className="rounded-2xl glass-strong border border-border/40 shadow-sm px-4 sm:px-6 py-3.5 flex items-center gap-4">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden p-2 rounded-md hover:bg-foreground/5"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Search */}
            <div className="relative flex-1 max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search…"
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {/* Theme toggle */}
              <button
                onClick={toggle}
                className="grid place-items-center h-9 w-9 rounded-lg hover:bg-foreground/5 text-foreground/80"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    setProfileOpen(false);
                  }}
                  className="relative grid place-items-center h-9 w-9 rounded-lg hover:bg-foreground/5 text-foreground/80"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotificationsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-96 rounded-2xl glass-strong shadow-elegant z-20 overflow-hidden animate-scale-in border border-border/50">
                      {/* Header */}
                      <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-[image:var(--gradient-primary)] text-white">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          <span className="font-semibold text-sm">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold px-1.5">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={() => markAllRead()}
                            className="text-xs text-white/80 hover:text-white font-medium flex items-center gap-1 transition"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Mark all read
                          </button>
                        )}
                      </div>

                      {/* Notification list */}
                      <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40">
                        {notifications.length === 0 ? (
                          <div className="py-12 flex flex-col items-center gap-3 text-center px-6">
                            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                              <Bell className="h-6 w-6 text-primary/50" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground/70">All caught up!</p>
                              <p className="text-xs text-muted-foreground mt-0.5">No notifications yet.</p>
                            </div>
                          </div>
                        ) : (
                          notifications.map((n) => {
                            const getIcon = () => {
                              switch (n.type) {
                                case "visitor_request": return { icon: UserCheck, color: "text-blue-500", bg: "bg-blue-500/10" };
                                case "visitor_approved": return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" };
                                case "visitor_rejected": return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" };
                                case "visitor_checked_in": return { icon: ShieldCheck, color: "text-violet-500", bg: "bg-violet-500/10" };
                                case "visitor_checked_out": return { icon: LogOut, color: "text-orange-500", bg: "bg-orange-500/10" };
                                case "bill_generated": return { icon: CreditCard, color: "text-amber-500", bg: "bg-amber-500/10" };
                                case "bill_paid": return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" };
                                case "complaint": return { icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10" };
                                case "maintenance": return { icon: Wrench, color: "text-cyan-500", bg: "bg-cyan-500/10" };
                                default: return { icon: Info, color: "text-primary", bg: "bg-primary/10" };
                              }
                            };
                            const { icon: Icon, color, bg } = getIcon();
                            const timeStr = new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

                            return (
                              <div
                                key={n.id}
                                className={cn(
                                  "flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-foreground/[0.04] group",
                                  !n.read ? "bg-primary/[0.04]" : "bg-transparent"
                                )}
                              >
                                {/* Icon bubble — click marks as read */}
                                <button
                                  onClick={() => { if (!n.read) markAsRead(n.id); }}
                                  className={cn("mt-0.5 h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center transition-transform group-hover:scale-110 focus:outline-none", bg)}
                                  title={n.read ? "Already read" : "Mark as read"}
                                >
                                  <Icon className={cn("h-4 w-4", color)} />
                                </button>

                                {/* Content — click navigates */}
                                <div
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => {
                                    if (!n.read) markAsRead(n.id);
                                    if (n.related_module) {
                                      setNotificationsOpen(false);
                                      const targetModule = n.related_module.toLowerCase();
                                      let targetPath = `/dashboard/${role.toLowerCase()}/${targetModule}`;
                                      if (role === "Resident" && targetModule === "visitors") targetPath = `/dashboard/resident`;
                                      else if (role === "Security" && targetModule === "visitors") targetPath = `/dashboard/security/active-visitors`;
                                      navigate({ to: targetPath as any });
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={cn("text-sm leading-snug", !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                                      {n.title}
                                    </p>
                                    {!n.read && (
                                      <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0 shadow-[0_0_6px_2px] shadow-primary/40" />
                                    )}
                                  </div>
                                  {n.message && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                                  )}
                                  <div className="flex items-center justify-between mt-1.5">
                                    <p className="text-[10px] text-muted-foreground/60">{timeStr}</p>
                                    {n.related_module && (
                                      <span className="text-[9px] uppercase tracking-wider bg-foreground/[0.06] px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">
                                        {n.related_module}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Footer */}
                      {notifications.length > 0 && (
                        <div className="px-5 py-3 border-t border-border/60 bg-foreground/[0.02] flex items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground">
                            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
                            {unreadCount > 0 && (
                              <span className="text-primary font-medium"> &middot; {unreadCount} unread</span>
                            )}
                          </p>
                          {notifications.some(n => n.read) && (
                            <button
                              onClick={() => clearReadNotifications()}
                              className="text-[11px] text-destructive/70 hover:text-destructive font-medium transition flex items-center gap-1"
                            >
                              <X className="h-3 w-3" /> Clear read
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setProfileOpen((v) => !v);
                    setNotificationsOpen(false);
                  }}
                  className="hidden sm:flex items-center gap-2.5 h-9 pl-2 pr-3 rounded-xl hover:bg-foreground/5 transition"
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 grid place-items-center text-primary text-[11px] font-bold">
                    {initials}
                  </div>
                  <span className="text-sm">{role}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-xl glass-strong shadow-elegant z-20 p-1.5 animate-scale-in">
                      <div className="px-3 py-2 border-b border-border mb-1">
                        <div className="text-sm font-medium">{displayName}</div>
                        <div className="text-[11px] text-muted-foreground">{userEmail}</div>
                      </div>
                      <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-foreground/5 text-left">
                        Profile Settings
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-destructive/10 text-destructive text-left"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning" | "accent";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <div className="rounded-2xl glass border border-border/40 shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="mt-2.5 text-3xl font-bold tracking-tight">{value}</div>
          {change && (
            <div className="mt-1 text-xs text-[color:var(--success)] font-medium">{change}</div>
          )}
        </div>
        <div className={cn("grid place-items-center h-10 w-10 rounded-xl", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger" | "muted" | "accent";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
    danger: "bg-destructive/15 text-destructive",
    muted: "bg-foreground/5 text-foreground/70",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium",
        toneMap[tone],
      )}
    >
      {children}
    </span>
  );
}
