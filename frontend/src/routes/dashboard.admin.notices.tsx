import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  X,
  Loader2,
  Pencil,
  FileText,
} from "lucide-react";
import { Badge, Card, DashboardLayout, StatCard } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { adminNav } from "@/components/dashboard/adminNav";
import {
  fetchAdminNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  fetchBlocks,
  NoticeRow,
  BlockRow,
} from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/admin/notices")({
  component: AdminNoticesPage,
});

const CATEGORIES = [
  "General", 
  "Maintenance", 
  "Security", 
  "Events", 
  "Emergency", 
  "Billing", 
  "Security Drill", 
  "Community Meeting", 
  "Power Shutdown", 
  "Water Tank Cleaning",
  "Other"
];
const PRIORITIES = ["Normal", "Important", "Urgent"];
const SHOW_SCHEDULE_CATEGORIES = ["Maintenance", "Events", "Security Drill", "Community Meeting", "Power Shutdown", "Water Tank Cleaning"];

const formatLocalDatetime = (date: Date = new Date()) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function AdminNoticesPage() {
  const [data, setData] = useState<NoticeRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<NoticeRow | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState("Normal");
  const [targetAudience, setTargetAudience] = useState("All Residents");
  const [targetBlock, setTargetBlock] = useState("");
  const [publishDate, setPublishDate] = useState(() => formatLocalDatetime());
  const [scheduledDate, setScheduledDate] = useState(() => formatLocalDatetime());
  const [expiryDate, setExpiryDate] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [noticesRes, blocksRes] = await Promise.all([fetchAdminNotices(), fetchBlocks()]);
    setData(noticesRes);
    setBlocks(blocksRes);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNew = () => {
    setSelectedNotice(null);
    setTitle("");
    setContent("");
    setCategory("General");
    setPriority("Normal");
    setTargetAudience("All Residents");
    setTargetBlock("");
    setPublishDate(formatLocalDatetime());
    setScheduledDate(formatLocalDatetime());
    setExpiryDate("");
    setErrorMsg("");
    setOpenModal(true);
  };

  const handleOpenEdit = (n: NoticeRow) => {
    setSelectedNotice(n);
    setTitle(n.title);
    setContent(n.content);
    setCategory(n.category);
    setPriority(n.priority);
    setTargetAudience(n.target_audience);
    setTargetBlock(n.target_block || "");
    setPublishDate(formatLocalDatetime(new Date(n.publish_date)));
    setScheduledDate(n.scheduled_at ? formatLocalDatetime(new Date(n.scheduled_at)) : "");
    setExpiryDate(n.expiry_date ? formatLocalDatetime(new Date(n.expiry_date)) : "");
    setErrorMsg("");
    setOpenModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return setErrorMsg("Title and content are required.");
    if (targetAudience === "Specific Block" && !targetBlock) return setErrorMsg("Please select a target block.");

    if (!publishDate) return setErrorMsg("Publish date is required.");

    setSaving(true);
    setErrorMsg("");

    try {
      const payload: Omit<NoticeRow, "id" | "created_at" | "created_by"> = {
        title,
        content,
        category,
        priority,
        target_audience: targetAudience,
        target_block: targetAudience === "All Residents" ? null : targetBlock,
        publish_date: new Date(publishDate).toISOString(),
        scheduled_at: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
      };

      if (selectedNotice) {
        const { error } = await updateNotice(selectedNotice.id, payload);
        if (error) throw new Error(error);
      } else {
        const { error } = await createNotice(payload);
        if (error) throw new Error(error);
      }
      setOpenModal(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save notice");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNotice) return;
    if (!confirm("Are you sure you want to delete this notice?")) return;
    setSaving(true);
    try {
      await deleteNotice(selectedNotice.id);
      setOpenModal(false);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getNoticeStatus = (n: NoticeRow) => {
    const now = new Date();
    if (new Date(n.publish_date) > now) return "Scheduled";
    if (n.scheduled_at && new Date(n.scheduled_at) > now) return "Scheduled";
    if (n.expiry_date && new Date(n.expiry_date) < now) return "Expired";
    return "Active";
  };

  const stats = useMemo(() => {
    let active = 0;
    let expired = 0;
    let scheduled = 0;

    data.forEach((n) => {
      const status = getNoticeStatus(n);
      if (status === "Active") active++;
      if (status === "Expired") expired++;
      if (status === "Scheduled") scheduled++;
    });

    return { total: data.length, active, expired, scheduled };
  }, [data]);

  const filteredNotices = useMemo(() => {
    return data.filter((n) => {
      const status = getNoticeStatus(n);
      if (filterStatus !== "All" && status !== filterStatus) return false;
      if (filterCategory !== "All" && n.category !== filterCategory) return false;
      
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.target_audience.toLowerCase().includes(q);
    });
  }, [data, searchQuery, filterCategory, filterStatus]);

  const getToneForPriority = (p: string) => {
    if (p === "Urgent") return "danger";
    if (p === "Important") return "warning";
    return "primary";
  };

  const getToneForStatus = (s: string) => {
    if (s === "Active") return "success";
    if (s === "Scheduled") return "warning";
    return "accent";
  };

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="Notices & Announcements"
          subtitle="Manage community announcements and broadcast important information."
          actions={
            <button
              type="button"
              onClick={handleOpenNew}
              className="inline-flex h-10 px-4 items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-bold shadow-elegant hover:shadow-glow transition"
            >
              <Plus className="h-4 w-4" /> New Notice
            </button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Notices" value={loading ? "..." : String(stats.total)} icon={FileText} tone="primary" />
          <StatCard label="Active Notices" value={loading ? "..." : String(stats.active)} icon={Megaphone} tone="success" />
          <StatCard label="Scheduled" value={loading ? "..." : String(stats.scheduled)} icon={Clock} tone="warning" />
          <StatCard label="Expired" value={loading ? "..." : String(stats.expired)} icon={AlertCircle} tone="accent" />
        </div>

        <Card title="Notice Directory">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
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
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-foreground/5">
                <tr>
                  <th className="px-4 py-3 font-medium rounded-tl-lg">Title & Info</th>
                  <th className="px-4 py-3 font-medium">Audience</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium rounded-tr-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading notices...
                    </td>
                  </tr>
                ) : filteredNotices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No notices found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredNotices.map((n) => {
                    const status = getNoticeStatus(n);
                    return (
                      <tr key={n.id} className="hover:bg-foreground/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{n.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{n.category}</span>
                            <span>•</span>
                            <span>Published: {new Date(n.publish_date).toLocaleDateString()}</span>
                            {n.scheduled_at && (
                              <>
                                <span>•</span>
                                <span className="text-primary font-medium">Scheduled: {new Date(n.scheduled_at).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">
                            <Badge tone="primary">
                              {n.target_audience === "All Residents" ? "All Residents" : `Block ${n.target_block}`}
                            </Badge>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">
                            <Badge tone={getToneForPriority(n.priority) as any}>
                              {n.priority}
                            </Badge>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">
                            <Badge tone={getToneForStatus(status) as any}>
                              {status}
                            </Badge>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleOpenEdit(n)} className="p-2 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {selectedNotice ? <Pencil className="h-5 w-5 text-primary" /> : <Megaphone className="h-5 w-5 text-primary" />}
                {selectedNotice ? "Edit Notice" : "Create Notice"}
              </h3>
              <button onClick={() => setOpenModal(false)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-foreground/10 transition text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form id="notice-form" onSubmit={handleSave} className="flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Notice Title *</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition" placeholder="e.g. Scheduled Water Maintenance" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Priority</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer">
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Notice Content *</label>
                  <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="w-full p-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition resize-none" placeholder="Provide full details here..." />
                </div>

                <div className="border-t border-border/50 pt-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Targeting & Schedule</h4>
                  
                  <div className="grid grid-cols-1 gap-4 pb-4 border-b border-border/20">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        Scheduled Date & Time (Optional)
                      </label>
                      <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Audience</label>
                      <select value={targetAudience} onChange={(e) => {
                        setTargetAudience(e.target.value);
                        if (e.target.value === "All Residents") setTargetBlock("");
                      }} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer">
                        <option value="All Residents">All Residents</option>
                        <option value="Specific Block">Specific Block</option>
                      </select>
                    </div>
                    {targetAudience === "Specific Block" && (
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Select Block *</label>
                        <select value={targetBlock} onChange={(e) => setTargetBlock(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer">
                          <option value="">Choose Block...</option>
                          {blocks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Publish Date & Time *</label>
                      <input type="datetime-local" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Expiry Date & Time</label>
                      <input type="datetime-local" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-background/50">
                {selectedNotice && (
                  <button type="button" disabled={saving} onClick={handleDelete} className="h-10 px-4 mr-auto rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-bold flex items-center gap-2 transition disabled:opacity-50">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
                <button type="button" disabled={saving} onClick={() => setOpenModal(false)} className="h-10 px-5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-sm font-bold transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex h-10 px-6 items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-bold shadow-elegant hover:shadow-glow transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {selectedNotice ? "Update Notice" : "Publish Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
