import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/services/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import {
  Badge,
  Card,
  DashboardLayout,
  StatCard,
} from "@/components/dashboard/DashboardLayout";

import { adminNav } from "@/components/dashboard/adminNav";

import {
  Field,
  FilterPill,
  GhostButton,
  Modal,
  PageHeader,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "@/components/dashboard/PageHeader";

import {
  fetchFlatsWithBlocks,
  insertFlat,
  updateFlat,
  deleteFlat,
  fetchBlocks,
} from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/admin/flats")({
  head: () => ({
    meta: [{ title: "Flats — Communa Admin" }],
  }),
  component: FlatsPage,
});

type Flat = {
  id: string;
  block_id: string;
  block: string;
  flat: string;
  floor: number;
  sqft: number;
  owner: string;
  status: "Occupied" | "Vacant" | "Reserved";
  created_at: string;
};

const normalizeStatus = (s: any): "Occupied" | "Vacant" | "Reserved" => {
  const val = (s ?? "").toString().trim().toLowerCase();
  if (val === "occupied") return "Occupied";
  if (val === "reserved") return "Reserved";
  return "Vacant";
};

function FlatsPage() {
  const [data, setData] = useState<Flat[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  // Modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Flat | null>(null);

  const perPage = 10;

  async function loadFlats() {
    setLoading(true);
    try {
      const [rows, blockRows] = await Promise.all([
        fetchFlatsWithBlocks(),
        fetchBlocks(),
      ]);

      setBlocks(blockRows);

      setData(
        (rows as any[]).map((r: any) => ({
          id: r.id,
          block_id: r.block_id,
          // blocks is a single object from the join (not array)
          block: (r.blocks as any)?.name ?? "Unknown",
          flat: r.flat_number,
          floor: r.floor ?? 0,
          sqft: r.sqft ?? 0,
          owner: r.owner_name ?? "",
          status: normalizeStatus(r.status),
          created_at: r.created_at ?? "",
        }))
      );
    } catch (err) {
      console.error("[FlatsPage] loadFlats error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlats();
  }, []);

  // Real-time updates: listen for changes in flats table
  useEffect(() => {
    const channel = supabase
      .channel("admin_flats_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flats" },
        () => {
          loadFlats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return data.filter((f) => {
      // Search by block name OR flat number (case-insensitive)
      const qLower = q.toLowerCase();
      const matchQ =
        !q ||
        f.flat.toLowerCase().includes(qLower) ||
        f.block.toLowerCase().includes(qLower) ||
        f.owner.toLowerCase().includes(qLower);

      const matchS = statusFilter === "All" || f.status === statusFilter;

      return matchQ && matchS;
    });
  }, [data, q, statusFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const slice = filtered.slice((page - 1) * perPage, page * perPage);

  const tone = (s: Flat["status"]) =>
    s === "Occupied"
      ? "success"
      : s === "Vacant"
        ? "muted"
        : "warning";

  const occupiedCount = data.filter((f) => f.status === "Occupied").length;
  const vacantCount = data.filter((f) => f.status === "Vacant").length;
  const reservedCount = data.filter((f) => f.status === "Reserved").length;
  const occupancyRate =
    data.length > 0 ? Math.round((occupiedCount / data.length) * 100) : 0;

  const onSave = async (f: Flat) => {
    if (editing) {
      // Edit existing flat
      const result = await updateFlat(f.id, {
        flat_number: f.flat,
        floor: f.floor,
        sqft: f.sqft,
        owner_name: f.owner,
        status: f.status.toLowerCase() as any,
      });
      if (result.error) {
        alert("Error updating flat: " + result.error);
        return;
      }
    } else {
      // Add new flat — occupancy_status defaults to 'vacant', created_at = now()
      const result = await insertFlat({
        block_id: f.block_id,
        flat_number: f.flat,
        floor: f.floor,
        sqft: f.sqft,
        owner_name: f.owner || null,
        type: null,
      });
      if (result.error) {
        alert("Error adding flat: " + result.error);
        return;
      }
    }

    await loadFlats();
    setOpen(false);
    setEditing(null);
  };

  const onDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this flat? This action cannot be undone."
      )
    ) {
      return;
    }
    const result = await deleteFlat(id);
    if (result.error) {
      alert("Error deleting flat: " + result.error);
      return;
    }
    await loadFlats();
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="Flats Management"
          subtitle="Manage flat inventory and occupancy across all blocks."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={loadFlats}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <PrimaryButton
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Flat
              </PrimaryButton>
            </div>
          }
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Flats"
            value={data.length.toString()}
            icon={Building2}
            tone="primary"
          />
          <StatCard
            label="Occupied"
            value={occupiedCount.toString()}
            change={`${occupancyRate}% occupancy`}
            icon={Building2}
            tone="success"
          />
          <StatCard
            label="Vacant"
            value={vacantCount.toString()}
            icon={Building2}
            tone="accent"
          />
          <StatCard
            label="Reserved"
            value={reservedCount.toString()}
            icon={Building2}
            tone="warning"
          />
        </div>

        {/* Filters and Search */}
        <Card
          title={`${filtered.length} Flats`}
          action={
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Search block, flat number or owner..."
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
          }
        >
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <div className="flex flex-wrap gap-2">
              {["All", "Occupied", "Vacant", "Reserved"].map((s) => (
                <FilterPill
                  key={s}
                  active={statusFilter === s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                >
                  {s}
                </FilterPill>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground animate-pulse">
              Loading flats from database...
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-muted-foreground border-b border-border">
                      <th className="px-4 py-3">Flat Number</th>
                      <th className="px-4 py-3">Block Name</th>
                      <th className="px-4 py-3">Floor</th>
                      <th className="px-4 py-3">Sqft</th>
                      <th className="px-4 py-3">Owner Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {slice.length > 0 ? (
                      slice.map((f) => (
                        <tr key={f.id} className="hover:bg-foreground/3 transition">
                          <td className="px-4 py-3">
                            <span className="font-medium">{f.flat}</span>
                          </td>
                          <td className="px-4 py-3 text-foreground/70">{f.block}</td>
                          <td className="px-4 py-3 text-foreground/70">{f.floor}</td>
                          <td className="px-4 py-3 text-foreground/70">{f.sqft} sqft</td>
                          <td className="px-4 py-3 text-foreground/70">{f.owner || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge tone={tone(f.status)}>
                              {f.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-foreground/60 text-xs">
                            {formatDate(f.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setEditing(f); setOpen(true); }}
                                className="p-2 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition"
                                title="Edit flat"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onDelete(f.id)}
                                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                                title="Delete flat"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          <div className="flex items-center justify-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>No flats found matching your criteria</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {slice.length > 0 ? (
                  slice.map((f) => (
                    <div
                      key={f.id}
                      className="p-4 rounded-xl glass hover:shadow-elegant transition border border-border/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold">{f.flat}</div>
                          <div className="text-xs text-muted-foreground">
                            {f.block} • Floor {f.floor}
                          </div>
                        </div>
                        <Badge tone={tone(f.status)}>{f.status}</Badge>
                      </div>
                      <div className="space-y-1 mb-3 text-sm text-foreground/70">
                        <div>Owner: {f.owner || "—"}</div>
                        <div>{f.sqft} sqft</div>
                        <div className="text-xs">Created: {formatDate(f.created_at)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditing(f); setOpen(true); }}
                          className="flex-1 px-3 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-sm font-medium transition flex items-center justify-center gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(f.id)}
                          className="flex-1 px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-sm font-medium text-destructive transition flex items-center justify-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                    <p>No flats found</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Page {page} of {totalPages} • Showing {slice.length} of {filtered.length} flats
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                      page === p
                        ? "bg-[image:var(--gradient-primary)] text-white"
                        : "hover:bg-foreground/5"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <FlatModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        flat={editing}
        blocks={blocks}
        onSave={onSave}
      />
    </DashboardLayout>
  );
}

/* ================= MODAL ================= */

function FlatModal({
  open,
  onClose,
  flat,
  blocks,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  flat: Flat | null;
  blocks: any[];
  onSave: (f: Flat) => void;
}) {
  const emptyForm: Flat = {
    id: "",
    block_id: "",
    block: "",
    flat: "",
    floor: 1,
    sqft: 1000,
    owner: "",
    status: "Vacant",
    created_at: "",
  };

  const [form, setForm] = useState<Flat>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (flat) {
      setForm(flat);
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [flat, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.block_id) newErrors.block_id = "Block is required";
    if (!form.flat.trim()) newErrors.flat = "Flat number is required";
    if (form.floor < 0) newErrors.floor = "Floor must be 0 or higher";
    if (form.sqft < 1) newErrors.sqft = "Sqft must be at least 1";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const selectedBlock = blocks.find((b) => b.id === form.block_id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={flat ? "Edit Flat" : "Add New Flat"}
      footer={
        <div className="flex gap-2">
          <GhostButton onClick={onClose} disabled={saving}>Cancel</GhostButton>
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : flat ? "Update Flat" : "Add Flat"}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Block Name (from blocks table) */}
          <Field label="Block Name">
            <SelectInput
              value={form.block_id}
              onChange={(e: any) => {
                const sel = blocks.find((b) => b.id === e.target.value);
                setForm({
                  ...form,
                  block_id: e.target.value,
                  block: sel?.name || "",
                });
                setErrors({ ...errors, block_id: "" });
              }}
              disabled={!!flat} // Can't change block when editing
            >
              <option value="">Select Block</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectInput>
            {errors.block_id && (
              <p className="text-xs text-destructive mt-1">{errors.block_id}</p>
            )}
            {!!flat && (
              <p className="text-xs text-muted-foreground mt-1">Block cannot be changed after creation.</p>
            )}
          </Field>

          {/* Flat Number */}
          <Field label="Flat Number">
            <TextInput
              placeholder="e.g., A-101"
              value={form.flat}
              onChange={(e: any) => {
                setForm({ ...form, flat: e.target.value });
                setErrors({ ...errors, flat: "" });
              }}
            />
            {errors.flat && (
              <p className="text-xs text-destructive mt-1">{errors.flat}</p>
            )}
          </Field>

          {/* Floor */}
          <Field label="Floor">
            <TextInput
              type="number"
              min="0"
              value={form.floor}
              onChange={(e: any) => {
                setForm({ ...form, floor: Number(e.target.value) });
                setErrors({ ...errors, floor: "" });
              }}
            />
            {errors.floor && (
              <p className="text-xs text-destructive mt-1">{errors.floor}</p>
            )}
          </Field>

          {/* Sqft */}
          <Field label="Size (sqft)">
            <TextInput
              type="number"
              min="1"
              value={form.sqft}
              onChange={(e: any) => {
                setForm({ ...form, sqft: Number(e.target.value) });
                setErrors({ ...errors, sqft: "" });
              }}
            />
            {errors.sqft && (
              <p className="text-xs text-destructive mt-1">{errors.sqft}</p>
            )}
          </Field>

          {/* Owner Name */}
          <Field label="Owner Name">
            <TextInput
              placeholder="Leave empty if vacant"
              value={form.owner}
              onChange={(e: any) =>
                setForm({ ...form, owner: e.target.value })
              }
            />
          </Field>

          {/* Occupancy Status — only shown when editing */}
          {flat && (
            <Field label="Occupancy Status">
              <SelectInput
                value={form.status}
                onChange={(e: any) =>
                  setForm({ ...form, status: e.target.value })
                }
              >
                <option value="Occupied">Occupied</option>
                <option value="Vacant">Vacant</option>
                <option value="Reserved">Reserved</option>
              </SelectInput>
            </Field>
          )}

          {/* When adding, inform user status will be 'vacant' automatically */}
          {!flat && (
            <Field label="Occupancy Status">
              <div className="h-9 px-3 rounded-lg bg-foreground/5 border border-border flex items-center text-sm text-muted-foreground">
                <span className="text-success font-medium">Vacant</span>
                <span className="ml-2 text-xs">(set automatically)</span>
              </div>
            </Field>
          )}
        </div>

        {selectedBlock && (
          <div className="p-3 rounded-lg bg-foreground/5 border border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Block:</span> {selectedBlock.name}{" "}
              •{" "}
              <span className="font-medium">Total Units:</span>{" "}
              {selectedBlock.total_flats}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}