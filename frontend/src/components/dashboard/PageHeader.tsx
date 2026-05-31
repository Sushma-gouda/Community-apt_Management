import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 px-4 items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-medium shadow-elegant hover:shadow-glow transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 px-4 items-center gap-2 rounded-lg glass text-sm font-medium hover:bg-foreground/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl glass-strong shadow-elegant p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-foreground/5"
          >
            ×
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-6 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-10 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition"
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full h-10 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition"
    />
  );
}

export function FilterPill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center h-8 px-3 rounded-full text-xs font-medium transition " +
        (active
          ? "bg-[image:var(--gradient-primary)] text-white shadow-elegant"
          : "bg-foreground/5 text-foreground/70 hover:bg-foreground/10")
      }
    >
      {children}
    </button>
  );
}
