import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const links = [
  { label: "Features", href: "#features" },
  { label: "Roles", href: "#roles" },
  { label: "Automation", href: "#automation" },
  { label: "Why Us", href: "#why" },
];

export function Navbar() {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled ? "py-3" : "py-5",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl px-4 sm:px-6 py-3 transition-all duration-500",
            scrolled ? "glass-strong shadow-card" : "glass-dark",
          )}
        >
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative grid place-items-center h-9 w-9 rounded-xl bg-[image:var(--gradient-primary)] shadow-glow">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className={cn("text-sm font-semibold", scrolled ? "text-foreground" : "text-white")}>Communa</div>
              <div className={cn("text-[10px] uppercase tracking-[0.2em]", scrolled ? "text-muted-foreground" : "text-white/60")}>
                Apartment OS
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={cn("px-4 py-2 text-sm rounded-lg transition", scrolled ? "text-foreground/80 hover:text-foreground hover:bg-foreground/5" : "text-white/80 hover:text-white hover:bg-white/5")}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className={cn("hidden sm:grid place-items-center h-9 w-9 rounded-lg transition", scrolled ? "text-foreground/80 hover:text-foreground hover:bg-foreground/10" : "text-white/80 hover:text-white hover:bg-white/10")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/signin"
              className={cn("hidden sm:inline-flex h-9 items-center px-4 text-sm", scrolled ? "text-foreground/90 hover:text-foreground" : "text-white/90 hover:text-white")}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-9 items-center px-4 rounded-lg text-sm font-medium text-white bg-[image:var(--gradient-primary)] shadow-elegant hover:opacity-95 transition"
            >
              Get Started
            </Link>
            <button
              onClick={() => setOpen((v) => !v)}
              className={cn("md:hidden grid place-items-center h-9 w-9 rounded-lg", scrolled ? "text-foreground hover:bg-foreground/10" : "text-white hover:bg-white/10")}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden mt-2 glass-strong rounded-2xl p-2 animate-fade-in">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm text-foreground/80 hover:bg-foreground/5 rounded-lg"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
