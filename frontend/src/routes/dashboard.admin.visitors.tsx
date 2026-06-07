import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { type LucideIcon, Search, X, LogIn, LogOut, Phone, Car, User } from "lucide-react";
import { Badge, Card, DashboardLayout, StatCard } from "@/components/dashboard/DashboardLayout";
import { adminNav } from "@/components/dashboard/adminNav";
import { FilterPill, PageHeader } from "@/components/dashboard/PageHeader";
import { fetchVisitorsDetailed, type VisitorDetailed } from "@/services/supabase/community";
import { supabase } from "@/services/supabase/client";

export const Route = createFileRoute("/dashboard/admin/visitors")({
  head: () => ({ meta: [{ title: "Visitors — Communa Admin" }] }),
  component: VisitorsPage,
});

function VisitorsPage() {
  const [data, setData] = useState<VisitorDetailed[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | string>("All");
  const [selected, setSelected] = useState<VisitorDetailed | null>(null);

  const loadData = () => {
    fetchVisitorsDetailed().then(setData);
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("admin_visitors_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(
    () =>
      data.filter((v) => {
        const matchQ =
          !q ||
          v.name.toLowerCase().includes(q.toLowerCase()) ||
          v.flat.toLowerCase().includes(q.toLowerCase());
        const matchStatus = statusFilter === "All" || v.status === statusFilter.toLowerCase().replace(" ", "_");
        return matchQ && matchStatus;
      }),
    [data, q, statusFilter],
  );

  const active = useMemo(() => data.filter((v) => v.status === 'checked_in'), [data]);
  
  const tone = (status: string) =>
    status === 'pending' ? 'warning' :
    status === 'approved' ? 'accent' :
    status === 'checked_in' ? 'primary' :
    status === 'rejected' ? 'danger' : 'muted';

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader title="Visitors" subtitle="Live visitor logs and gate activity." />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Visitors Today" value={String(data.filter(v => v.entry_time_raw && new Date(v.entry_time_raw).toDateString() === new Date().toDateString()).length)} icon={User} tone="primary" />
          <StatCard
            label="Currently Inside"
            value={String(active.length)}
            icon={LogIn}
            tone="success"
          />
          <StatCard
            label="Deliveries"
            value={String(data.filter((v) => v.purpose === "Delivery").length)}
            icon={Car}
            tone="warning"
          />
          <StatCard label="Pending Requests" value={String(data.filter(v => v.status === 'pending').length)} icon={LogOut} tone="accent" />
        </div>

        <Card title={`Active Visitors (${active.length})`}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className="text-left rounded-xl glass p-4 hover:shadow-card transition"
              >
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center h-10 w-10 rounded-full bg-[image:var(--gradient-primary)] text-white font-semibold text-sm">
                    {v.name
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{v.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      → {v.flat} · {v.host}
                    </div>
                  </div>
                  <Badge tone="primary">{v.purpose}</Badge>
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-2">
                  <LogIn className="h-3 w-3" /> Checked in {v.checkIn}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card
          title="Visitor Log"
          action={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or flat..."
                className="h-9 pl-9 pr-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:border-input focus:outline-none w-56"
              />
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(["All", "Pending", "Approved", "Checked In", "Checked Out", "Rejected"] as const).map((t) => (
              <FilterPill key={t} active={statusFilter === t} onClick={() => setStatusFilter(t)}>
                {t}
              </FilterPill>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-2 py-2 font-medium">ID</th>
                  <th className="px-2 py-2 font-medium">Visitor</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Flat</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">In</th>
                  <th className="px-2 py-2 font-medium">Out</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setSelected(v)}
                    className="border-b border-border last:border-0 hover:bg-foreground/[0.03] cursor-pointer"
                  >
                    <td className="px-2 py-3 font-medium text-muted-foreground">{v.id.substring(0, 6)}</td>
                    <td className="px-2 py-3">
                      <div>{v.name}</div>
                      <div className="text-xs text-muted-foreground">{v.phone}</div>
                    </td>
                    <td className="px-2 py-3 text-foreground/80">{v.purpose}</td>
                    <td className="px-2 py-3">
                      <div>{v.flat}</div>
                      <div className="text-xs text-muted-foreground">{v.host}</div>
                    </td>
                    <td className="px-2 py-3">
                      <Badge tone={tone(v.status)}>{v.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Badge>
                    </td>
                    <td className="px-2 py-3 text-foreground/80">{v.checkIn || "—"}</td>
                    <td className="px-2 py-3 text-foreground/80">{v.checkOut || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl glass-strong shadow-elegant p-6 animate-scale-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">Visitor Details</h3>
              <button
                onClick={() => setSelected(null)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-foreground/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-center space-y-2 mb-5">
              <div className="mx-auto grid place-items-center h-16 w-16 rounded-full bg-[image:var(--gradient-primary)] text-white text-lg font-semibold">
                {selected.name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="text-xl font-semibold">{selected.name}</div>
              <Badge tone={tone(selected.status)}>{selected.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Badge>
            </div>
            <div className="space-y-2.5 text-sm">
              <Detail icon={Phone} label="Phone" value={selected.phone} />
              <Detail icon={User} label="Visiting" value={`${selected.host} (${selected.flat})`} />
              <Detail icon={Car} label="Purpose" value={selected.purpose} />
              <Detail icon={LogIn} label="Checked in" value={selected.checkIn || "—"} />
              <Detail icon={LogOut} label="Checked out" value={selected.checkOut || "—"} />
              {selected.vehicle && <Detail icon={Car} label="Vehicle" value={selected.vehicle} />}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03]">
      <span className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
