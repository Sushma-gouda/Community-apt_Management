import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { X, Clock, User, Building2, AlertTriangle } from "lucide-react";
import { Badge, Card, DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { adminNav } from "@/components/dashboard/adminNav";
import { FilterPill, PageHeader, PrimaryButton, GhostButton } from "@/components/dashboard/PageHeader";
import {
  fetchComplaintsAll,
  updateComplaintStatus,
  updateComplaintPriority,
  fetchResidentsDirectory,
  type ComplaintRow
} from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/admin/complaints")({
  head: () => ({ meta: [{ title: "Complaints — Communa Admin" }] }),
  component: ComplaintsPage,
});

type Status = "Open" | "In Progress" | "Resolved";
type Priority = "Low" | "Medium" | "High" | "Critical";

type Complaint = {
  id: string;
  title: string;
  desc: string;
  by: string;
  flat: string;
  status: Status;
  priority: Priority;
  created: string;
  category: string;
  raw_id: string; // Internal DB ID
};

const statusMap: Record<string, Status> = {
  open: "Open",
  pending: "Open", // for safety
  "in_progress": "In Progress",
  "in-progress": "In Progress",
  resolved: "Resolved",
};

function ComplaintsPage() {
  const [data, setData] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"All" | Status>("All");
  const [priority, setPriority] = useState<"All" | Priority>("All");
  const [selected, setSelected] = useState<Complaint | null>(null);

  async function load() {
    setLoading(true);
    try {
      const rows = await fetchComplaintsAll();
      const res = await fetchResidentsDirectory();

      const mapped = rows
        .map((r) => {
          // Find resident to get name/flat
          const resi = res.find(re => re.id === r.resident_id);
          return {
            id: `C-${String(r.id).slice(0, 4).toUpperCase()}`,
            raw_id: String(r.id),
            title: r.title,
            desc: r.description || "",
            by: resi?.name || "Unknown",
            flat: resi?.flat_number || r.flat_label || "N/A",
            status: statusMap[r.status] || "Open",
            priority: (r.priority ? (r.priority.charAt(0).toUpperCase() + r.priority.slice(1)) as Priority : "Medium"),
            created: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            category: r.category || "General",
          };
        });
      setData(mapped);
    } catch (err) {
      console.error("Error loading complaints:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      data.filter(
        (c) =>
          (status === "All" || c.status === status) &&
          (priority === "All" || c.priority === priority),
      ),
    [data, status, priority],
  );

  const statusTone = (s: Status) =>
    s === "Open" ? "warning" : s === "In Progress" ? "primary" : "success";
  const prioTone = (p: Priority) =>
    p === "Critical" ? "danger" : p === "High" ? "warning" : p === "Medium" ? "primary" : "muted";

  const advance = async (id: string, currentStatus: Status) => {
    const nextStatus = currentStatus === "Open" ? "in-progress" : "resolved";
    const { error } = await updateComplaintStatus(id, nextStatus);
    if (error) {
      alert("Error updating status: " + error);
    } else {
      load();
    }
  };

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="Complaints"
          subtitle="Track and resolve resident-reported issues."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: "Open", v: data.filter((c) => c.status === "Open").length, c: "var(--warning)" },
            {
              l: "In Progress",
              v: data.filter((c) => c.status === "In Progress").length,
              c: "var(--primary)",
            },
            {
              l: "Resolved",
              v: data.filter((c) => c.status === "Resolved").length,
              c: "var(--success)",
            },
            {
              l: "Critical",
              v: data.filter((c) => c.priority === "Critical").length,
              c: "var(--destructive)",
            },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl glass shadow-card p-5">
              <div className="text-xs text-muted-foreground">{s.l}</div>
              <div
                className="mt-2 text-2xl font-semibold transition"
                style={{ color: `oklch(from ${s.c} l c h)` }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>

        <Card title="Filters">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Status:</span>
            {(["All", "Open", "In Progress", "Resolved"] as const).map((s) => (
              <FilterPill key={s} active={status === s} onClick={() => setStatus(s)}>
                {s}
              </FilterPill>
            ))}
            <span className="text-xs text-muted-foreground mx-1 ml-3">Priority:</span>
            {(["All", "Low", "Medium", "High", "Critical"] as const).map((p) => (
              <FilterPill key={p} active={priority === p} onClick={() => setPriority(p)}>
                {p}
              </FilterPill>
            ))}
          </div>
        </Card>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading complaints...</div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="text-left rounded-2xl glass shadow-card p-5 hover:shadow-elegant transition group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-xs text-muted-foreground">
                    {c.id} · {c.category}
                  </div>
                  <Badge tone={prioTone(c.priority)}>{c.priority}</Badge>
                </div>
                <h3 className="font-semibold text-base group-hover:text-primary transition">
                  {c.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.desc}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> {c.by} <span className="opacity-50">·</span> {c.flat}
                  </div>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {c.created}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-muted-foreground glass rounded-2xl">
                No complaints found matching your filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-xl rounded-2xl glass-strong shadow-elegant p-6 animate-scale-in">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  {selected.id} · {selected.category}
                </div>
                <h3 className="text-xl font-semibold mt-1">{selected.title}</h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-foreground/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Badge tone={prioTone(selected.priority)}>
                <AlertTriangle className="h-3 w-3 mr-1" /> {selected.priority}
              </Badge>
              <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
              <span className="ml-auto text-xs text-muted-foreground">{selected.created}</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{selected.desc}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-foreground/[0.03] p-3 flex items-center gap-3">
                <span className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[11px] text-muted-foreground">Reported by</div>
                  <div className="text-sm font-medium">{selected.by}</div>
                </div>
              </div>
              <div className="rounded-xl bg-foreground/[0.03] p-3 flex items-center gap-3">
                <span className="grid place-items-center h-9 w-9 rounded-lg bg-accent/15 text-accent">
                  <Building2 className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[11px] text-muted-foreground">Flat</div>
                  <div className="text-sm font-medium">{selected.flat}</div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Change Priority:</span>
                <select
                  value={selected.priority}
                  onChange={async (e) => {
                    const newP = e.target.value;
                    const { error } = await updateComplaintPriority(selected.raw_id, newP);
                    if (error) alert(error);
                    else load();
                    setSelected(null);
                  }}
                  className="h-8 px-2 text-xs rounded-md bg-foreground/5 border border-transparent focus:bg-background focus:ring-1 focus:ring-ring transition"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <GhostButton onClick={() => setSelected(null)}>Close</GhostButton>
                {selected.status !== "Resolved" && (
                  <PrimaryButton
                    onClick={() => {
                      advance(selected.raw_id, selected.status);
                      setSelected(null);
                    }}
                  >
                    {selected.status === "Open" ? "Mark In Progress" : "Mark Resolved"}
                  </PrimaryButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
