import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { type LucideIcon, Search, UserPlus, Mail, Phone, Building2, X, Trash2, Pencil } from "lucide-react";
import { Badge, Card, DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { adminNav } from "@/components/dashboard/adminNav";
import { FilterPill, PageHeader, PrimaryButton, Modal, Field, TextInput, SelectInput, GhostButton } from "@/components/dashboard/PageHeader";
import { 
  fetchResidentsDirectory, 
  updateResident, 
  deleteResident, 
  fetchBlocks, 
  fetchVacantFlatsByBlock,
  adminCreateResident 
} from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/admin/residents")({
  head: () => ({ meta: [{ title: "Residents — Communa Admin" }] }),
  component: ResidentsPage,
});

type Resident = {
  id: string;
  name: string;
  email: string;
  phone: string;
  flat: string;
  block: string;
  status: "Active" | "Inactive";
  since: string;
  family: number;
  flat_id: string; // Internal ID for updates
};

function ResidentsPage() {
  const [data, setData] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [block, setBlock] = useState("All");
  const [selected, setSelected] = useState<Resident | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [blocksList, setBlocksList] = useState<any[]>([]);
  const [availableFlats, setAvailableFlats] = useState<any[]>([]);
  const [flatsLoading, setFlatsLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    block_id: "",
    flat_id: "",
    family_count: 1,
    password: ""
  });

  async function load() {
    setLoading(true);
    try {
      const rows = await fetchResidentsDirectory();
      setData(
        rows.map((r) => ({
          id: r.id,
          // `r.name` is the actual DB column; `r.full_name` is an alias added in fetchResidentsDetailed
          name: (r as any).name || (r as any).full_name || "Unknown",
          email: r.email,
          phone: r.phone || "—",
          flat: r.flat_number,
          block: r.block_name,
          status: r.status === "inactive" ? "Inactive" : "Active",
          since: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—",
          family: r.family_count || 0,
          flat_id: r.flat_id
        }))
      );
      const b = await fetchBlocks();
      setBlocksList(b);
    } catch (err) {
      console.error("Error loading residents:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Fetch flats when block changes in Add Modal
  useEffect(() => {
    if (form.block_id) {
      setFlatsLoading(true);
      fetchVacantFlatsByBlock(form.block_id)
        .then(setAvailableFlats)
        .finally(() => setFlatsLoading(false));
    } else {
      setAvailableFlats([]);
    }
  }, [form.block_id]);

  const blockOptions = useMemo(() => {
    const b = new Set(data.map(r => r.block));
    return ["All", ...Array.from(b).sort()];
  }, [data]);

  const filtered = useMemo(
    () =>
      data.filter((r) => {
        const matchQ =
          !q ||
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          r.flat.toLowerCase().includes(q.toLowerCase());
        const matchB = block === "All" || r.block === block;
        return matchQ && matchB;
      }),
    [data, q, block],
  );

  const handleAddResident = async () => {
    if (!form.full_name || !form.email || !form.flat_id) return alert("Please fill required fields");
    
    const flat = availableFlats.find(f => f.id === form.flat_id);

    const { error } = await adminCreateResident({
      flatId: form.flat_id,
      fullName: form.full_name,
      email: form.email,
      phone: form.phone,
      familyCount: form.family_count,
      password: form.password || undefined,
      blockId: form.block_id,
      flatNumber: flat?.flat_number
    });

    if (error) {
      alert("Error: " + error);
    } else {
      setIsAddModalOpen(false);
      setForm({ full_name: "", email: "", phone: "", block_id: "", flat_id: "", family_count: 1, password: "" });
      load();
    }
  };

  const handleDelete = async (r: Resident) => {
    if (!confirm(`Are you sure you want to remove ${r.name}? This will also mark flat ${r.flat} as vacant.`)) return;
    
    const { error } = await deleteResident(r.id, r.flat_id);
    if (error) {
      alert("Error deleting: " + error);
    } else {
      setSelected(null);
      load();
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    if (!form.full_name || !form.email) return alert("Name and Email are required");

    console.log("[Residents] Updating resident:", selected.id, form);
    
    // `name` is the actual column in the `residents` table (not `full_name`)
    const { error } = await updateResident(selected.id, {
      name: form.full_name,
      email: form.email,
      phone: form.phone,
      family_count: form.family_count || 1
    });

    if (error) {
      alert("Error updating: " + error);
    } else {
      console.log("[Residents] Update successful");
      setIsEditModalOpen(false);
      setSelected(null);
      await load();
    }
  };

  const handleToggleStatus = async () => {
    if (!selected) return;
    const newStatus = selected.status === "Active" ? "inactive" : "active";
    const { error } = await updateResident(selected.id, { status: newStatus });
    if (error) {
      alert("Error updating status: " + error);
    } else {
      setSelected({ ...selected, status: newStatus === "active" ? "Active" : "Inactive" });
      load();
    }
  };

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="Residents"
          subtitle="Directory of all residents across the community."
          actions={
            <PrimaryButton onClick={() => setIsAddModalOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add Resident
            </PrimaryButton>
          }
        />

        <Card
          title={`${filtered.length} Residents`}
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
            {blockOptions.map((b) => (
              <FilterPill key={b} active={block === b} onClick={() => setBlock(b)}>
                {b === "All" ? "All Blocks" : `Block ${b}`}
              </FilterPill>
            ))}
          </div>

          {loading ? (
            <div className="py-20 text-center text-muted-foreground">Loading residents...</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="grid sm:hidden gap-3">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="text-left p-4 rounded-xl glass hover:shadow-card transition"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.flat} · Block {r.block}
                        </div>
                      </div>
                      <Badge tone={r.status === "Active" ? "success" : "muted"}>{r.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-2 py-2 font-medium">Name</th>
                      <th className="px-2 py-2 font-medium">Email</th>
                      <th className="px-2 py-2 font-medium">Phone</th>
                      <th className="px-2 py-2 font-medium">Flat</th>
                      <th className="px-2 py-2 font-medium">Block</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="border-b border-border last:border-0 hover:bg-foreground/[0.03] cursor-pointer transition"
                      >
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.name} />
                            <span className="font-medium">{r.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-foreground/80">{r.email}</td>
                        <td className="px-2 py-3 text-foreground/80">{r.phone}</td>
                        <td className="px-2 py-3">{r.flat}</td>
                        <td className="px-2 py-3">Block {r.block}</td>
                        <td className="px-2 py-3">
                          <Badge tone={r.status === "Active" ? "success" : "muted"}>{r.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Profile Drawer */}
      <div
        className={
          "fixed inset-0 z-50 transition " +
          (selected ? "pointer-events-auto" : "pointer-events-none")
        }
      >
        <div
          onClick={() => setSelected(null)}
          className={
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition " +
            (selected ? "opacity-100" : "opacity-0")
          }
        />
        <aside
          className={
            "absolute right-0 top-0 h-full w-full sm:w-[420px] glass-strong shadow-elegant transition-transform duration-300 " +
            (selected ? "translate-x-0" : "translate-x-full")
          }
        >
          {selected && (
            <div className="h-full flex flex-col">
              <div className="p-5 flex items-center justify-between border-b border-border">
                <h3 className="text-lg font-semibold">Resident Profile</h3>
                <button
                  onClick={() => setSelected(null)}
                  className="h-8 w-8 grid place-items-center rounded-lg hover:bg-foreground/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 space-y-5 overflow-y-auto">
                <div className="flex flex-col items-center text-center">
                  <Avatar name={selected.name} size="lg" />
                  <div className="mt-3 text-xl font-semibold">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Resident since {selected.since}
                  </div>
                  <Badge tone={selected.status === "Active" ? "success" : "muted"}>
                    {selected.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Family Members" value={String(selected.family)} />
                  <Stat label="Flat" value={selected.flat} />
                </div>
                <div className="space-y-2.5">
                  <Row icon={Mail} label="Email" value={selected.email} />
                  <Row icon={Phone} label="Phone" value={selected.phone} />
                  <Row icon={Building2} label="Block" value={selected.block} />
                </div>
                <div className="pt-3 flex items-center gap-2">
                  <PrimaryButton onClick={() => {
                    setForm({
                      full_name: selected.name,
                      email: selected.email,
                      phone: selected.phone === "—" ? "" : selected.phone,
                      block_id: "", // Not used for edit
                      flat_id: selected.flat_id,
                      family_count: selected.family
                    });
                    setIsEditModalOpen(true);
                  }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Profile
                  </PrimaryButton>
                  <GhostButton onClick={handleToggleStatus}>
                    {selected.status === "Active" ? "Set Inactive" : "Set Active"}
                  </GhostButton>
                  <button 
                    onClick={() => handleDelete(selected)}
                    className="h-10 px-4 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Add Resident Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Resident"
        footer={
          <div className="flex gap-2">
            <GhostButton onClick={() => setIsAddModalOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={handleAddResident}>Add Resident</PrimaryButton>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="Full Name">
            <TextInput 
              value={form.full_name} 
              onChange={e => setForm({...form, full_name: e.target.value})} 
              placeholder="e.g. John Doe"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <TextInput 
                type="email"
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                placeholder="john@example.com"
              />
            </Field>
            <Field label="Phone">
              <TextInput 
                value={form.phone} 
                onChange={e => setForm({...form, phone: e.target.value})} 
                placeholder="+91 ..."
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Block">
              <SelectInput 
                value={form.block_id} 
                onChange={e => setForm({...form, block_id: e.target.value, flat_id: ""})}
              >
                <option value="">Select Block</option>
                {blocksList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Flat (Vacant)">
              <SelectInput 
                disabled={!form.block_id || flatsLoading}
                value={form.flat_id} 
                onChange={e => setForm({...form, flat_id: e.target.value})}
              >
                <option value="">{flatsLoading ? "Loading..." : "Select Flat"}</option>
                {availableFlats.map(f => <option key={f.id} value={f.id}>{f.flat_number}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Family Members">
              <TextInput 
                type="number"
                min="1"
                value={form.family_count || ""} 
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setForm({...form, family_count: isNaN(val) ? 0 : val});
                }} 
              />
            </Field>
            <Field label="Set Password (Optional)">
              <TextInput 
                type="password"
                value={form.password || ""} 
                onChange={e => setForm({...form, password: e.target.value})} 
                placeholder="Leave blank to let them sign up"
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Edit Resident Modal */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Resident Profile"
        footer={
          <div className="flex gap-2">
            <GhostButton onClick={() => setIsEditModalOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={handleUpdate}>Save Changes</PrimaryButton>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="Full Name">
            <TextInput value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          </Field>
          <Field label="Family Members">
            <TextInput 
              type="number"
              min="1"
              value={form.family_count || ""} 
              onChange={e => {
                const val = parseInt(e.target.value);
                setForm({...form, family_count: isNaN(val) ? 0 : val});
              }} 
            />
          </Field>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  const cls = size === "lg" ? "h-16 w-16 text-lg" : "h-9 w-9 text-xs";
  return (
    <div
      className={`grid place-items-center rounded-full bg-[image:var(--gradient-primary)] text-white font-semibold ${cls}`}
    >
      {initials}
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl glass p-3 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
