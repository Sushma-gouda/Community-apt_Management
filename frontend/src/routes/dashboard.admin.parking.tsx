import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Car, Bike, Truck, Search, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { Badge, Card, DashboardLayout, StatCard } from "@/components/dashboard/DashboardLayout";
import { adminNav } from "@/components/dashboard/adminNav";
import {
  FilterPill,
  PageHeader,
  PrimaryButton,
  Modal,
  Field,
  TextInput,
  SelectInput,
  GhostButton,
} from "@/components/dashboard/PageHeader";
import { supabase } from "@/services/supabase/client";
import {
  fetchParkingAllDetailed,
  assignParkingSlot,
  updateParkingSlot,
  deleteParkingSlot,
  fetchResidentsDetailed,
  type ParkingDetailed,
} from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/admin/parking")({
  head: () => ({ meta: [{ title: "Parking — Communa Admin" }] }),
  component: ParkingPage,
});

type Slot = {
  id: string;
  type: "Car" | "Bike" | "EV";
  status: "Free" | "Occupied";
  flat?: string;
  vehicle?: string;
  dbData?: ParkingDetailed;
};

type ResidentOption = { id: string; flat_id: string; name: string; flat_number: string; block_name: string; };

function ParkingPage() {
  const [data, setData] = useState<ParkingDetailed[]>([]);
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | Slot["status"]>("All");

  const [openModal, setOpenModal] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<ParkingDetailed | null>(null);
  const [prefilledSlot, setPrefilledSlot] = useState<string | null>(null);

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      const [detailedParking, residentsData] = await Promise.all([
        fetchParkingAllDetailed(),
        fetchResidentsDetailed(),
      ]);
      setData(detailedParking);
      // Build resident options with flat_id for assignment
      setResidents(
        residentsData.map((r) => ({
          id: r.id,
          flat_id: r.flat_id,
          name: r.full_name || r.name,
          flat_number: r.flat_number,
          block_name: r.block_name,
        }))
      );
    } catch (e) {
      console.error("Failed to load parking data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Set up real-time subscription for instant synchronization
    const channel = supabase
      .channel("parking-admin-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parking" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute 40 slots from real DB data
  const slots: Slot[] = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => {
      const slotId = `P-${String(i + 1).padStart(3, "0")}`;
      const dbMatch = data.find((p) => p.slot_number === slotId);

      if (dbMatch) {
        return {
          id: slotId,
          type: dbMatch.vehicle_type as Slot["type"],
          status: "Occupied",
          flat: `${dbMatch.block_name}-${dbMatch.flat_number}`,
          vehicle: dbMatch.plate_number,
          dbData: dbMatch,
        };
      }

      // Default type pattern to preserve original visual grid styling
      const types: Slot["type"][] = ["Car", "Car", "Bike", "EV"];
      const t = types[i % 4];
      return {
        id: slotId,
        type: t,
        status: "Free",
      };
    });
  }, [data]);

  const display = slots.filter((s) => filter === "All" || s.status === filter);

  // Search filtered registry
  const filteredParking = useMemo(() => {
    return data.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.slot_number.toLowerCase().includes(q) ||
        p.flat_number.toLowerCase().includes(q) ||
        p.block_name.toLowerCase().includes(q) ||
        p.plate_number.toLowerCase().includes(q) ||
        (p.vehicle_model && p.vehicle_model.toLowerCase().includes(q)) ||
        p.resident_name.toLowerCase().includes(q)
      );
    });
  }, [data, searchQuery]);

  const stats = {
    total: slots.length,
    occupied: slots.filter((s) => s.status === "Occupied").length,
    free: slots.filter((s) => s.status === "Free").length,
  };

  const handleOpenRegister = () => {
    setSelectedAllocation(null);
    setPrefilledSlot(null);
    setOpenModal(true);
  };

  const handleSlotClick = (s: Slot) => {
    if (s.status === "Occupied" && s.dbData) {
      setSelectedAllocation(s.dbData);
      setPrefilledSlot(null);
      setOpenModal(true);
    } else {
      setSelectedAllocation(null);
      setPrefilledSlot(s.id);
      setOpenModal(true);
    }
  };

  const onSave = async (p: {
    id?: string;
    flat_id: string; // text flat_id — no numeric conversion
    slot_number: string;
    vehicle_type: "Car" | "Bike" | "EV";
    vehicle_model: string;
    plate_number: string;
  }): Promise<{ error: string | null }> => {
    const duplicate = data.find(
      (item) => item.slot_number === p.slot_number && item.id !== p.id
    );
    if (duplicate) {
      return {
        error: `Parking Slot ${p.slot_number} is already assigned to ${duplicate.block_name}-${duplicate.flat_number}!`,
      };
    }

    let result;
    if (p.id) {
      result = await updateParkingSlot(p.id, {
        vehicle_type: p.vehicle_type,
        vehicle_model: p.vehicle_model,
        plate_number: p.plate_number,
        flat_id: p.flat_id,
        slot_number: p.slot_number,
      });
    } else {
      result = await assignParkingSlot({
        flat_id: p.flat_id,
        slot_number: p.slot_number,
        vehicle_type: p.vehicle_type,
        vehicle_model: p.vehicle_model,
        plate_number: p.plate_number,
      });
    }

    if (!result.error) {
      await loadData();
    }
    return result;
  };

  const onDelete = async (id: string): Promise<{ error: string | null }> => {
    const result = await deleteParkingSlot(id);
    if (!result.error) {
      await loadData();
    }
    return result;
  };

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="Parking"
          subtitle="Live slot occupancy and vehicle registry."
          actions={
            <PrimaryButton onClick={handleOpenRegister}>
              <Plus className="h-4 w-4" /> Register Vehicle
            </PrimaryButton>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total Slots" value={String(stats.total)} icon={Car} tone="primary" />
          <StatCard label="Occupied" value={String(stats.occupied)} icon={Car} tone="warning" />
          <StatCard label="Free" value={String(stats.free)} icon={Car} tone="success" />
        </div>

        <Card title="Slot Map">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(["All", "Free", "Occupied"] as const).map((s) => (
              <FilterPill key={s} active={filter === s} onClick={() => setFilter(s)}>
                {s}
              </FilterPill>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {display.map((s) => {
                const cls =
                  s.status === "Free"
                    ? "bg-[color:var(--success)]/10 text-[color:var(--success)] hover:bg-[color:var(--success)]/20 border-[color:var(--success)]/20"
                    : "bg-[color:var(--warning)]/10 text-[color:var(--warning)] hover:bg-[color:var(--warning)]/20 border-[color:var(--warning)]/20";
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSlotClick(s)}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition ${cls}`}
                  >
                    <span className="text-xs font-semibold">{s.id}</span>
                    <span className="text-[9px] uppercase tracking-wider opacity-85">
                      {s.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t border-border/50 pt-4">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[color:var(--success)]/20 border border-[color:var(--success)]/30" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[color:var(--warning)]/20 border border-[color:var(--warning)]/30" />
              Occupied (Click to manage)
            </span>
          </div>
        </Card>

        <Card title="Vehicle Registry">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Flat, Owner name, Slot, Plate number, or Model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : filteredParking.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredParking.map((v) => {
                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl glass border border-border/50 hover:border-primary/30 transition flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold tracking-wider">{v.plate_number}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                          {v.vehicle_type}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAllocation(v);
                          setOpenModal(true);
                        }}
                        className="h-8 w-8 grid place-items-center rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                      <div className="text-xs text-muted-foreground">{v.vehicle_model || "—"}</div>
                      <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-semibold">
                        {v.slot_number}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-foreground/80 flex items-center justify-between">
                      <span>
                        {v.resident_name} · {v.block_name}-{v.flat_number}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-6 w-6 mx-auto mb-2" />
              <p>No registered vehicles found</p>
            </div>
          )}
        </Card>
      </div>

      <ParkingModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setSelectedAllocation(null);
          setPrefilledSlot(null);
        }}
        allocation={selectedAllocation}
        prefilledSlot={prefilledSlot}
        residents={residents}
        onSave={onSave}
        onDelete={onDelete}
      />
    </DashboardLayout>
  );
}

function ParkingModal({
  open,
  onClose,
  allocation,
  prefilledSlot,
  residents,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  allocation: ParkingDetailed | null;
  prefilledSlot: string | null;
  residents: ResidentOption[];
  onSave: (p: {
    id?: string;
    flat_id: string;
    slot_number: string;
    vehicle_type: "Car" | "Bike" | "EV";
    vehicle_model: string;
    plate_number: string;
  }) => Promise<{ error: string | null }>;
  onDelete?: (id: string) => Promise<{ error: string | null }>;
}) {
  const [slotNumber, setSlotNumber] = useState("");
  const [flatId, setFlatId] = useState("");
  const [vehicleType, setVehicleType] = useState<"Car" | "Bike" | "EV">("Car");
  const [vehicleModel, setVehicleModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (allocation) {
      setSlotNumber(allocation.slot_number);
      setFlatId(String(allocation.flat_id)); // always text
      setVehicleType(allocation.vehicle_type);
      setVehicleModel(allocation.vehicle_model || "");
      setPlateNumber(allocation.plate_number);
    } else {
      setSlotNumber(prefilledSlot || "");
      setFlatId("");
      setVehicleType("Car");
      setVehicleModel("");
      setPlateNumber("");
    }
    setError("");
    setLoading(false);
  }, [allocation, prefilledSlot, open]);

  const handleSubmit = async () => {
    if (!slotNumber) return setError("Slot number is required");
    if (!flatId) return setError("Flat selection is required");
    if (!plateNumber.trim()) return setError("Plate number is required");

    setError("");
    setLoading(true);
    try {
      const res = await onSave({
        id: allocation?.id,
        flat_id: flatId, // text flat_id — pass directly
        slot_number: slotNumber,
        vehicle_type: vehicleType,
        vehicle_model: vehicleModel,
        plate_number: plateNumber,
      });

      if (res.error) {
        setError(res.error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={allocation ? "Edit Parking Slot" : "Register Vehicle / Assign Slot"}
      footer={
        <div className="flex gap-2 w-full justify-between items-center">
          {allocation && onDelete && (
            <button
              disabled={loading}
              onClick={async () => {
                if (confirm("Are you sure you want to release this parking slot?")) {
                  setLoading(true);
                  setError("");
                  try {
                    const res = await onDelete(allocation.id);
                    if (res.error) {
                      setError(res.error);
                    } else {
                      onClose();
                    }
                  } catch (err: any) {
                    setError(err?.message || "Failed to release slot");
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              className="inline-flex h-10 px-4 items-center gap-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-medium transition disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> {loading ? "Releasing..." : "Release Slot"}
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <GhostButton onClick={onClose} disabled={loading}>
              Cancel
            </GhostButton>
            <PrimaryButton onClick={handleSubmit} disabled={loading}>
              {loading
                ? allocation
                  ? "Updating..."
                  : "Assigning..."
                : allocation
                  ? "Update Assignment"
                  : "Assign Slot"}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2 border border-destructive/20 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Parking Slot">
            <SelectInput
              value={slotNumber}
              onChange={(e: any) => setSlotNumber(e.target.value)}
              disabled={!!allocation || loading}
            >
              <option value="">Select Slot</option>
              {Array.from({ length: 40 }).map((_, i) => {
                const s = `P-${String(i + 1).padStart(3, "0")}`;
                return (
                  <option key={s} value={s}>
                    {s}
                  </option>
                );
              })}
            </SelectInput>
          </Field>

          <Field label="Assign to Resident">
            <SelectInput
              value={flatId}
              onChange={(e: any) => setFlatId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select Resident</option>
              {residents.map((r) => (
                <option key={r.flat_id} value={r.flat_id}>
                  {r.block_name} - {r.flat_number} · {r.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Vehicle Type">
            <SelectInput
              value={vehicleType}
              onChange={(e: any) => setVehicleType(e.target.value as any)}
              disabled={loading}
            >
              <option value="Car">Car</option>
              <option value="Bike">Bike</option>
              <option value="EV">EV</option>
            </SelectInput>
          </Field>

          <Field label="Plate Number">
            <TextInput
              placeholder="e.g., MH-12 AB-1234"
              value={plateNumber}
              onChange={(e: any) => setPlateNumber(e.target.value)}
              disabled={loading}
            />
          </Field>
        </div>

        <Field label="Vehicle Model">
          <TextInput
            placeholder="e.g., Honda City / Tata Nexon"
            value={vehicleModel}
            onChange={(e: any) => setVehicleModel(e.target.value)}
            disabled={loading}
          />
        </Field>
      </div>
    </Modal>
  );
}
