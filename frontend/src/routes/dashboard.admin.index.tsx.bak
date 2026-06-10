import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  adminResidentCount,
  adminFlatsOccupancy,
  adminComplaintStats,
  adminUnpaidBillsTotal,
  adminActiveVisitorCount,
  adminParkingStats,
  fetchRecentComplaints,
  fetchRecentBills,
  fetchFlatsWithBlocks,
  fetchVisitorsAll,
  type ComplaintRow,
  type BillRow,
  type VisitorDetailed,
} from "@/services/supabase/community";
import {
  Users,
  MessageSquareWarning,
  ShieldCheck,
  CreditCard,
  Car,
  Building2,
  TrendingUp,
} from "lucide-react";
import { Badge, Card, DashboardLayout, StatCard } from "@/components/dashboard/DashboardLayout";
import { adminNav } from "@/components/dashboard/adminNav";
import { formatDisplayName } from "@/lib/utils";

import { supabase } from "@/services/supabase/client";

export const Route = createFileRoute("/dashboard/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Communa" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { profile, user } = useAuth();

  const [stats, setStats] = useState({
    residents: 0,
    flatsOccupied: 0,
    flatsTotal: 0,
    complaints: 0,
    unpaidBills: 0,
    activeVisitors: 0,
    parkingOccupied: 0,
    parkingTotal: 40,
  });

  const [complaintsList, setComplaintsList] = useState<ComplaintRow[]>([]);
  const [payments, setPayments] = useState<BillRow[]>([]);
  const [blocksData, setBlocksData] = useState<{ b: string; occ: number; units: string }[]>([]);
  const [visitorsStats, setVisitorsStats] = useState({ guests: 0, delivery: 0, cab: 0, service: 0 });

  const rawDisplayName = profile?.full_name?.trim() || user?.user_metadata?.full_name?.trim() || "Admin";
  const displayName = formatDisplayName(rawDisplayName, "Admin");

  useEffect(() => {
    Promise.all([
      adminResidentCount(),
      adminFlatsOccupancy(),
      adminComplaintStats(),
      adminUnpaidBillsTotal(),
      adminActiveVisitorCount(),
      adminParkingStats(),
      fetchVisitorsAll(),
    ]).then(([res, flats, comp, bills, vis, parking, allVisitors]) => {
      setStats({
        residents: res,
        flatsOccupied: flats.occupied,
        flatsTotal: flats.total,
        complaints: comp.open,
        unpaidBills: bills,
        activeVisitors: vis,
        parkingOccupied: parking.occupied,
        parkingTotal: parking.total,
      });

      const today = new Date().toDateString();
      const todaysVisitors = allVisitors.filter(v => v.entry_time_raw && new Date(v.entry_time_raw).toDateString() === today);
      let guests = 0, delivery = 0, cab = 0, service = 0;
      todaysVisitors.forEach(v => {
        const p = v.purpose.toLowerCase();
        if (p === 'guest') guests++;
        else if (p === 'delivery') delivery++;
        else if (p === 'cab') cab++;
        else if (p === 'service') service++;
      });
      const total = todaysVisitors.length || 1; // prevent div by zero
      setVisitorsStats({
        guests: Math.round((guests / total) * 100),
        delivery: Math.round((delivery / total) * 100),
        cab: Math.round((cab / total) * 100),
        service: Math.round((service / total) * 100)
      });
    });

    fetchRecentComplaints(5).then(setComplaintsList);
    fetchRecentBills(5).then(setPayments);

    fetchFlatsWithBlocks().then((flats) => {
      const blockMap = new Map<string, { total: number; occupied: number }>();
      (flats as any[]).forEach((f) => {
        const b: string = (f.blocks as any)?.name ?? "Unknown";
        if (!blockMap.has(b)) blockMap.set(b, { total: 0, occupied: 0 });
        const stat = blockMap.get(b)!;
        stat.total += 1;
        if (String(f.status).toLowerCase() === "occupied") stat.occupied += 1;
      });
      const data = Array.from(blockMap.entries()).map(([b, stat]) => ({
        b,
        occ: stat.total > 0 ? Math.round((stat.occupied / stat.total) * 100) : 0,
        units: `${stat.occupied}/${stat.total}`,
      }));
      setBlocksData(data);
    });

    const channel = supabase
      .channel("admin_dashboard_visitors_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => {
        adminActiveVisitorCount().then((vis) => {
          setStats((prev) => ({
            ...prev,
            activeVisitors: vis,
          }));
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here's what's happening across your community today.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Total Residents"
            value={stats.residents.toString()}
            icon={Users}
            tone="primary"
          />
          <StatCard
            label="Occupied Flats"
            value={`${stats.flatsOccupied}/${stats.flatsTotal}`}
            icon={Building2}
            tone="accent"
          />
          <StatCard
            label="Pending Complaints"
            value={stats.complaints.toString()}
            icon={MessageSquareWarning}
            tone="warning"
          />
          <StatCard
            label="Unpaid Bills"
            value={`₹${stats.unpaidBills.toLocaleString()}`}
            icon={CreditCard}
            tone="warning"
          />
          <StatCard
            label="Active Visitors"
            value={stats.activeVisitors.toString()}
            icon={ShieldCheck}
            tone="success"
          />
          <StatCard label="Parking Usage" value={`${stats.parkingOccupied}/${stats.parkingTotal}`} icon={Car} tone="primary" />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card title="Maintenance Collections" action={<Badge tone="success">+12.4%</Badge>}>
              <LineChart
                points={[40, 55, 38, 72, 60, 80, 68, 90, 75, 85, 95, 88]}
                labels={["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
              />
            </Card>
          </div>
          <Card title="Today's Visitors Breakdown">
            <Donut
              segments={[
                { label: "Guests", value: visitorsStats.guests || 58, color: "var(--primary)" },
                { label: "Delivery", value: visitorsStats.delivery || 24, color: "var(--accent)" },
                { label: "Cab", value: visitorsStats.cab || 12, color: "var(--warning)" },
                { label: "Service", value: visitorsStats.service || 6, color: "var(--success)" },
              ]}
            />
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card
              title="Recent Complaints"
              action={
                <a className="text-xs text-primary hover:underline" href="#">
                  View all
                </a>
              }
            >
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-2 py-2 font-medium">ID</th>
                      <th className="px-2 py-2 font-medium">Title</th>
                      <th className="px-2 py-2 font-medium">Resident</th>
                      <th className="px-2 py-2 font-medium">Flat</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaintsList.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-border last:border-0 hover:bg-foreground/[0.02]"
                      >
                        <td className="px-2 py-3 font-medium">{c.id}</td>
                        <td className="px-2 py-3">{c.title}</td>
                        <td className="px-2 py-3 text-foreground/80">
                          {String(c.resident_id || "").substring(0, 8)}
                        </td>
                        <td className="px-2 py-3 text-foreground/80">{c.flat_label || "—"}</td>
                        <td className="px-2 py-3">
                          <Badge
                            tone={
                              c.status === "resolved"
                                ? "success"
                                : c.status === "open"
                                  ? "warning"
                                  : "primary"
                            }
                          >
                            {c.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <Card title="Activity Timeline">
            <div className="text-sm text-muted-foreground p-2">
              Activity timeline will go here...
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card
            title="Recent Payments"
            action={
              <a className="text-xs text-primary hover:underline" href="#">
                All transactions
              </a>
            }
          >
            <ul className="space-y-2.5">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/[0.03]"
                >
                  <div className="grid place-items-center h-9 w-9 rounded-lg bg-[color:var(--success)]/15 text-[color:var(--success)]">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {p.label} · ₹{p.amount}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.id} • {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge tone={p.status === "paid" ? "success" : "warning"}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Block Occupancy">
            <div className="space-y-3">
              {blocksData.map((b) => (
                <div key={b.b} className="flex items-center gap-3">
                  <div className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{b.b}</span>
                      <span className="text-muted-foreground text-xs">{b.units}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                        style={{ width: `${b.occ}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Quick Stats">
            <div className="space-y-4">
              {[
                { label: "Bills paid", value: "82%", color: "var(--success)" },
                { label: "Complaint SLA", value: "76%", color: "var(--warning)" },
                { label: "Visitor approvals", value: "98%", color: "var(--primary)" },
                { label: "Active staff", value: "100%", color: "var(--accent)" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-semibold">{s.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: s.value, background: `oklch(from ${s.color} l c h)` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function LineChart({ points, labels }: { points: number[]; labels: string[] }) {
  const w = 600,
    h = 180,
    pad = 16;
  const max = Math.max(...points);
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map(
    (p, i) => [pad + i * step, h - pad - (p / max) * (h - pad * 2)] as const,
  );
  const path = coords
    .map((c, i) => (i ? "L" : "M") + c[0].toFixed(1) + " " + c[1].toFixed(1))
    .join(" ");
  const area =
    path + ` L ${coords[coords.length - 1][0]} ${h - pad} L ${coords[0][0]} ${h - pad} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
        <defs>
          <linearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(from var(--primary) l c h)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="oklch(from var(--primary) l c h)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lc)" />
        <path
          d={path}
          fill="none"
          stroke="oklch(from var(--primary) l c h)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="oklch(from var(--primary-glow) l c h)" />
        ))}
      </svg>
      <div className="mt-1 grid grid-cols-12 gap-1 text-[10px] text-muted-foreground text-center">
        {labels.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>
    </div>
  );
}

function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 60,
    c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="h-36 w-36 -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="oklch(from var(--foreground) l c h / 0.06)"
          strokeWidth="20"
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={`oklch(from ${s.color} l c h)`}
              strokeWidth="20"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="flex-1 space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: `oklch(from ${s.color} l c h)` }}
              />
              <span className="text-foreground/80">{s.label}</span>
            </span>
            <span className="font-semibold">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
