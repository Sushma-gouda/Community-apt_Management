import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Wrench, Calendar, CheckCircle2, Clock, Tags, AlertCircle } from "lucide-react";
import { Badge, Card, DashboardLayout, StatCard } from "@/components/dashboard/DashboardLayout";
import { residentNav } from "@/components/dashboard/residentNav";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { supabase } from "@/services/supabase/client";
import { fetchMaintenanceAll, type MaintenanceRow } from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/resident/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — Communa" }] }),
  component: ResidentMaintenancePage,
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function ResidentMaintenancePage() {
  const [data, setData] = useState<MaintenanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"Ongoing" | "Upcoming" | "Completed">("Ongoing");

  const loadData = async () => {
    try {
      const allMaintenance = await fetchMaintenanceAll();
      setData(allMaintenance);
    } catch (e) {
      console.error("Failed to load maintenance records:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Set up real-time subscription for instant synchronization
    const channel = supabase
      .channel("maintenance-resident-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const ongoingTasks = useMemo(() => data.filter((t) => t.status === "In Progress"), [data]);
  const upcomingTasks = useMemo(() => data.filter((t) => t.status === "Scheduled"), [data]);
  const completedTasks = useMemo(() => data.filter((t) => t.status === "Completed").slice(0, 10), [data]); // Show recent 10

  const displayTasks = useMemo(() => {
    if (activeTab === "Ongoing") return ongoingTasks;
    if (activeTab === "Upcoming") return upcomingTasks;
    return completedTasks;
  }, [activeTab, ongoingTasks, upcomingTasks, completedTasks]);

  const getToneForPriority = (p: string) => {
    if (p === "Critical") return "danger";
    if (p === "High") return "warning";
    if (p === "Medium") return "primary";
    return "muted";
  };

  return (
    <DashboardLayout role="Resident" items={residentNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="Community Maintenance"
          subtitle="Track ongoing repairs and scheduled community service."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Ongoing Maintenance"
            value={loading ? "..." : String(ongoingTasks.length)}
            icon={Wrench}
            tone="primary"
          />
          <StatCard
            label="Upcoming Schedule"
            value={loading ? "..." : String(upcomingTasks.length)}
            icon={Calendar}
            tone="warning"
          />
          <StatCard
            label="Recently Completed"
            value={loading ? "..." : String(completedTasks.length)}
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        <Card title="Maintenance Board">
          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6 border-b border-border/40 pb-2 overflow-x-auto no-scrollbar">
            {(["Ongoing", "Upcoming", "Completed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-[image:var(--gradient-primary)] text-white shadow-elegant"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : displayTasks.length > 0 ? (
            <div className="space-y-4">
              {displayTasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl glass border border-border/50 p-5 hover:shadow-card transition flex flex-col md:flex-row md:items-start gap-4"
                >
                  <div className="grid place-items-center h-12 w-12 rounded-xl bg-foreground/5 text-foreground/70 shrink-0">
                    {t.status === "In Progress" ? (
                      <Wrench className="h-6 w-6 text-primary" />
                    ) : t.status === "Scheduled" ? (
                      <Calendar className="h-6 w-6 text-warning" />
                    ) : (
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1">
                      <h4 className="font-bold text-base leading-snug">{t.asset_name}</h4>
                      <div className="flex items-center gap-2">
                        {t.priority && t.status !== "Completed" && (
                          <Badge tone={getToneForPriority(t.priority)}>{t.priority}</Badge>
                        )}
                        <Badge
                          tone={
                            t.status === "Completed"
                              ? "success"
                              : t.status === "In Progress"
                                ? "primary"
                                : "warning"
                          }
                        >
                          {t.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-muted-foreground flex items-center gap-3 mb-3">
                      <span className="flex items-center gap-1"><Tags className="h-3 w-3" /> {t.category}</span>
                      <span>·</span>
                      <span>{t.location}</span>
                    </div>

                    {t.description && (
                      <p className="text-sm text-foreground/80 leading-relaxed mb-4">
                        {t.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-foreground/5 rounded-lg px-3 py-2">
                      {t.status !== "Completed" && t.scheduled_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Scheduled: <span className="font-semibold text-foreground">{formatDate(t.scheduled_date)}</span></span>
                        </div>
                      )}
                      {t.status === "Completed" && t.completion_date && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Completed: <span className="font-semibold text-foreground">{formatDate(t.completion_date)}</span></span>
                        </div>
                      )}
                      {(t.status === "In Progress" || t.status === "Scheduled") && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Status: <span className="font-semibold text-foreground">Updates pending</span></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
              <p className="text-base font-medium">No {activeTab.toLowerCase()} maintenance tasks.</p>
              <p className="text-sm mt-1">Everything is running smoothly.</p>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
