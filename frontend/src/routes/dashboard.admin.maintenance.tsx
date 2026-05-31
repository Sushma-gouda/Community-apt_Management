import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Plus, Wrench, Calendar, CheckCircle2, AlertCircle, Search, Pencil, Trash2, Loader2, DollarSign, Phone, User, X, Clock, AlignLeft, Tags } from "lucide-react";
import { Badge, Card, DashboardLayout, StatCard } from "@/components/dashboard/DashboardLayout";
import { adminNav } from "@/components/dashboard/adminNav";
import { PageHeader, PrimaryButton } from "@/components/dashboard/PageHeader";
import { supabase } from "@/services/supabase/client";
import {
  fetchMaintenanceAll,
  insertMaintenanceEntry,
  updateMaintenanceEntry,
  deleteMaintenanceEntry,
  fetchBlocks,
  type MaintenanceRow,
  type BlockRow,
} from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/admin/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance Tasks — Communa Admin" }] }),
  component: MaintenancePage,
});

const CATEGORIES = [
  "Lift", "Generator", "Water Tank", "Plumbing", "Electrical Systems", 
  "Fire Safety Equipment", "CCTV Systems", "Common Areas", "Garden/Landscaping", "Other Assets"
];

const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled"];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function toInputDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function MaintenancePage() {
  const [data, setData] = useState<MaintenanceRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<string>("All");

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceRow | null>(null);

  // Form Fields
  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [cost, setCost] = useState("0");
  const [vendorName, setVendorName] = useState("");
  const [vendorContact, setVendorContact] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("Scheduled");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [allMaintenance, allBlocks] = await Promise.all([
        fetchMaintenanceAll(),
        fetchBlocks(),
      ]);
      setData(allMaintenance);
      setBlocks(allBlocks);
    } catch (e) {
      console.error("Failed to load maintenance records:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("maintenance-admin-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleOpenNew = () => {
    setSelectedTask(null);
    setAssetName("");
    setCategory(CATEGORIES[0]);
    setDescription("");
    setLocation("");
    setScheduledDate("");
    setCompletionDate("");
    setCost("0");
    setVendorName("");
    setVendorContact("");
    setPriority("Medium");
    setStatus("Scheduled");
    setErrorMsg(null);
    setOpenModal(true);
  };

  const handleOpenEdit = (a: MaintenanceRow) => {
    setSelectedTask(a);
    setAssetName(a.asset_name || "");
    setCategory(a.category || CATEGORIES[0]);
    setDescription(a.description || "");
    setLocation(a.location || "");
    setScheduledDate(toInputDate(a.scheduled_date));
    setCompletionDate(toInputDate(a.completion_date));
    setCost(String(a.cost || 0));
    setVendorName(a.vendor_name || "");
    setVendorContact(a.vendor_contact || "");
    setPriority(a.priority || "Medium");
    setStatus(a.status || "Scheduled");
    setErrorMsg(null);
    setOpenModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim() || !category) {
      setErrorMsg("Asset Name and Category are required.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      asset_name: assetName.trim(),
      category,
      description: description.trim(),
      location: location.trim(),
      scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      completion_date: completionDate ? new Date(completionDate).toISOString() : null,
      cost: Number(cost) || 0,
      vendor_name: vendorName.trim(),
      vendor_contact: vendorContact.trim(),
      priority,
      status,
    };

    try {
      if (selectedTask) {
        const { error } = await updateMaintenanceEntry(selectedTask.id, payload);
        if (error) throw new Error(error);
      } else {
        const { error } = await insertMaintenanceEntry(payload);
        if (error) throw new Error(error);
      }
      setOpenModal(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save record.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;
    if (!confirm("Are you sure you want to delete this maintenance task?")) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = await deleteMaintenanceEntry(selectedTask.id);
      if (error) throw new Error(error);
      setOpenModal(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete record.");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    let overdueCount = 0;
    let totalCost = 0;

    data.forEach(task => {
      if (task.status !== "Cancelled") totalCost += Number(task.cost || 0);
      if (task.status !== "Completed" && task.status !== "Cancelled" && task.scheduled_date) {
        const sched = new Date(task.scheduled_date);
        if (sched < now) overdueCount++;
      }
    });

    return {
      total: data.length,
      scheduled: data.filter(a => a.status === "Scheduled").length,
      inProgress: data.filter(a => a.status === "In Progress").length,
      completed: data.filter(a => a.status === "Completed").length,
      overdue: overdueCount,
      cost: totalCost
    };
  }, [data]);

  const filteredTasks = useMemo(() => {
    return data.filter((a) => {
      const matchesFilter = filter === "All" || a.status === filter;
      if (!matchesFilter) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        (a.asset_name && a.asset_name.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.location && a.location.toLowerCase().includes(q)) ||
        (a.vendor_name && a.vendor_name.toLowerCase().includes(q))
      );
    });
  }, [data, searchQuery, filter]);

  const getToneForStatus = (s: string) => {
    if (s === "Completed") return "success";
    if (s === "In Progress") return "primary";
    if (s === "Scheduled") return "warning";
    return "muted";
  };

  const getToneForPriority = (p: string) => {
    if (p === "Critical") return "destructive";
    if (p === "High") return "warning";
    if (p === "Medium") return "primary";
    return "muted";
  };

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="Maintenance"
          subtitle="Track community maintenance tasks, records, and expenses."
          actions={
            <button
              type="button"
              onClick={handleOpenNew}
              className="inline-flex h-10 px-4 items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-bold shadow-elegant hover:shadow-glow transition"
            >
              <Plus className="h-4 w-4" /> Add Task
            </button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Tasks" value={loading ? "..." : String(stats.total)} icon={Wrench} tone="primary" />
          <StatCard label="Scheduled" value={loading ? "..." : String(stats.scheduled)} icon={Calendar} tone="warning" />
          <StatCard label="In Progress" value={loading ? "..." : String(stats.inProgress)} icon={Clock} tone="primary" />
          <StatCard label="Completed" value={loading ? "..." : String(stats.completed)} icon={CheckCircle2} tone="success" />
          <StatCard label="Overdue" value={loading ? "..." : String(stats.overdue)} icon={AlertCircle} tone="accent" />
          <StatCard label="Total Cost" value={loading ? "..." : `$${stats.cost.toLocaleString()}`} icon={DollarSign} tone="success" />
        </div>

        <Card title="Maintenance Records">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by asset, category, vendor, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(["All", ...STATUSES]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 h-9 text-[11px] font-semibold rounded-lg transition ${
                    filter === s
                      ? "bg-[image:var(--gradient-primary)] text-white shadow-elegant"
                      : "bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : filteredTasks.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTasks.map((a) => {
                return (
                  <div
                    key={a.id}
                    onClick={() => handleOpenEdit(a)}
                    className="rounded-xl glass p-4 hover:shadow-card transition cursor-pointer border border-border/50 hover:border-primary/30 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-sm leading-snug">{a.asset_name}</div>
                        <Badge tone={getToneForStatus(a.status)}>{a.status}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-2 mb-3">
                        <span className="flex items-center gap-1"><Tags className="h-3 w-3" /> {a.category}</span>
                        {a.priority && <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold ${
                          a.priority === 'Critical' ? 'bg-destructive/10 text-destructive' :
                          a.priority === 'High' ? 'bg-warning/10 text-warning' :
                          'bg-primary/10 text-primary'
                        }`}>Priority: {a.priority}</span>}
                      </div>
                      {a.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{a.description}</p>
                      )}
                    </div>

                    <div className="mt-auto pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div>Sched: <span className="font-medium text-foreground/80">{formatDate(a.scheduled_date)}</span></div>
                      <div>Cost: <span className="font-medium text-foreground/80">${a.cost?.toLocaleString() || 0}</span></div>
                      {a.vendor_name && <div className="col-span-2">Vendor: <span className="font-medium text-foreground/80">{a.vendor_name}</span></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm">No maintenance records found matching your filters.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Schedule / Edit Maintenance Modal Form */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl glass-strong border border-border/80 shadow-elegant overflow-hidden animate-scale-in">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between shrink-0 bg-background/50">
              <h3 className="text-lg font-bold tracking-tight">
                {selectedTask ? "Edit Maintenance Task" : "Add Maintenance Task"}
              </h3>
              <button
                onClick={() => setOpenModal(false)}
                className="text-muted-foreground hover:text-foreground h-8 w-8 grid place-items-center rounded-lg hover:bg-foreground/5 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form id="maintenance-form" onSubmit={handleSave} className="flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar space-y-5">
                {errorMsg && (
                  <div className="mb-6 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Asset / Facility Name *</label>
                  <input type="text" required placeholder="e.g. Lift A1" value={assetName} onChange={(e) => setAssetName(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Category *</label>
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full p-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition resize-none" placeholder="Describe the task..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Location</label>
                    <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer">
                      <option value="">Select Location...</option>
                      <option value="Common Area">Common Area</option>
                      <option value="Basement">Basement</option>
                      <option value="Clubhouse">Clubhouse</option>
                      {blocks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Scheduled Date</label>
                    <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Completion Date</label>
                    <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition cursor-pointer" />
                  </div>
                </div>

                <div className="border-t border-border/40 pt-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <User className="h-4 w-4" /> Vendor & Cost
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Vendor Name</label>
                      <input type="text" placeholder="e.g. Otis Care" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Service Cost ($)</label>
                      <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full h-11 px-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Fixed at bottom) */}
              <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-3 shrink-0 bg-background/50">
                {selectedTask && (
                  <button type="button" disabled={saving} onClick={handleDelete} className="h-10 px-4 mr-auto rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-bold flex items-center gap-2 transition disabled:opacity-50">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
                <button type="button" disabled={saving} onClick={() => setOpenModal(false)} className="h-10 px-5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-sm font-bold transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex h-10 px-6 items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-bold shadow-elegant hover:shadow-glow transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {selectedTask ? "Save Changes" : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
