import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Megaphone, Search, Clock, Calendar, AlertCircle, FileText } from "lucide-react";
import { Badge, Card, DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { residentNav } from "@/components/dashboard/residentNav";
import { fetchResidentNotices, NoticeRow } from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/resident/notices")({
  component: ResidentNoticesPage,
});

function ResidentNoticesPage() {
  const [data, setData] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const CATEGORIES = ["General", "Maintenance", "Security", "Events", "Emergency", "Billing", "Other"];

  useEffect(() => {
    fetchResidentNotices().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  const filteredNotices = useMemo(() => {
    return data.filter((n) => {
      if (filterCategory !== "All" && n.category !== filterCategory) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    });
  }, [data, searchQuery, filterCategory]);

  const getToneForPriority = (p: string) => {
    if (p === "Urgent") return "danger";
    if (p === "Important") return "warning";
    return "primary";
  };

  return (
    <DashboardLayout role="Resident" items={residentNav}>
      <div className="space-y-6 animate-fade-up max-w-5xl mx-auto">
        <PageHeader
          title="Notices & Announcements"
          subtitle="Stay updated with the latest community news, alerts, and maintenance schedules."
        />

        <Card title="All Notices">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search notices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                <p>Loading notices...</p>
              </div>
            ) : filteredNotices.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground bg-foreground/5 rounded-xl border border-dashed border-border/50">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No notices found matching your criteria.</p>
              </div>
            ) : (
              filteredNotices.map((n) => (
                <div key={n.id} className="p-5 rounded-xl bg-foreground/5 border border-border/50 hover:bg-foreground/10 transition group">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <Badge tone={getToneForPriority(n.priority) as any}>
                          {n.priority}
                        </Badge>
                        <Badge tone="accent">
                          {n.category}
                        </Badge>
                        {n.target_audience !== "All Residents" && (
                          <Badge tone="primary">
                            Block {n.target_block} Only
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {n.title}
                      </h3>
                      
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {n.content}
                      </p>
                    </div>

                    <div className="shrink-0 flex sm:flex-col gap-4 sm:gap-2 text-xs text-muted-foreground bg-background/50 p-3 rounded-lg sm:text-right">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Published: {new Date(n.publish_date).toLocaleDateString()}</span>
                      </div>
                      {n.scheduled_at && (
                        <div className="flex items-center gap-1.5 text-primary/80">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Scheduled: {new Date(n.scheduled_at).toLocaleDateString()}</span>
                        </div>
                      )}
                      {n.expiry_date && (
                        <div className="flex items-center gap-1.5 text-warning/80">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Expires: {new Date(n.expiry_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
