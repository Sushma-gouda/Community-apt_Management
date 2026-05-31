import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Layers,
  Maximize2,
  Calendar,
  Car,
  Wifi,
  Dumbbell,
  Waves,
  Shield,
  MapPin,
  UserCheck,
} from "lucide-react";
import { Card, DashboardLayout, Badge } from "@/components/dashboard/DashboardLayout";
import { residentNav } from "@/components/dashboard/residentNav";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  fetchMyProfile,
  fetchBillsForResident,
  fetchResidentParking,
  type BillRow,
  type ParkingDetailed,
} from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/resident/flat")({
  head: () => ({ meta: [{ title: "My Flat — Communa" }] }),
  component: ResidentFlat,
});

const amenities = [
  { icon: Wifi, label: "High-Speed WiFi", desc: "1 Gbps fiber in common areas" },
  { icon: Dumbbell, label: "Gym", desc: "Open 6 AM – 10 PM" },
  { icon: Waves, label: "Swimming Pool", desc: "Open 7 AM – 8 PM" },
  { icon: Car, label: "Parking", desc: "Covered basement parking" },
  { icon: Shield, label: "24/7 Security", desc: "CCTV + security guards" },
  { icon: Layers, label: "Lift", desc: "2 lifts per block" },
];

function ResidentFlat() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    flat_number: string;
    block: string;
    floor: string;
    sqft: string;
    type: string;
    owner_name: string;
    family_count: number;
    since: string;
    bills: BillRow[];
    parking: ParkingDetailed | null;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const p = await fetchMyProfile();
      if (p) {
        const [bills, myParkingSlots] = await Promise.all([
          fetchBillsForResident(p.id),
          fetchResidentParking(),
        ]);

        const myParking = myParkingSlots.length > 0 ? myParkingSlots[0] : null;

        setData({
          flat_number: p.flat_number,
          block: p.block_name,
          floor: String(p.floor),
          sqft: String(p.sqft),
          type: p.type,
          owner_name: p.owner_name,
          family_count: p.family_count || 1,
          since: p.created_at
            ? new Date(p.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—",
          bills,
          parking: myParking as any,
        });
      }
    } catch (err) {
      console.error("Error loading flat data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return (
      <DashboardLayout role="Resident" items={residentNav}>
        <div className="py-20 text-center text-muted-foreground animate-pulse">
          Loading flat details...
        </div>
      </DashboardLayout>
    );
  }

  const latestBill = data.bills[0];

  return (
    <DashboardLayout role="Resident" items={residentNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader title="My Flat" subtitle="Details about your flat and community amenities." />

        {/* Hero flat card */}
        <div
          className="relative overflow-hidden rounded-2xl shadow-elegant p-6 sm:p-8 text-white"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="absolute inset-0 opacity-30 mix-blend-overlay gradient-mesh" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/70">Your Flat</div>
                <div className="mt-1 text-5xl font-semibold tracking-tight">{data.flat_number}</div>
                <div className="mt-2 text-white/80">
                  {data.block} · {data.floor}
                  {data.floor.endsWith("1")
                    ? "st"
                    : data.floor.endsWith("2")
                      ? "nd"
                      : data.floor.endsWith("3")
                        ? "rd"
                        : "th"}{" "}
                  Floor · Communa Heights
                </div>
              </div>
              <div className="grid place-items-center h-16 w-16 rounded-2xl bg-white/15 backdrop-blur-sm">
                <Building2 className="h-8 w-8" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Area", value: `${data.sqft} sqft` },
                { label: "Type", value: data.type },
                {
                  label: "Floor",
                  value: `${data.floor}${data.floor.endsWith("1") ? "st" : data.floor.endsWith("2") ? "nd" : data.floor.endsWith("3") ? "rd" : "th"}`,
                },
                { label: "Facing", value: "East" },
              ].map((d) => (
                <div key={d.label} className="rounded-xl bg-white/10 backdrop-blur-sm p-3">
                  <div className="text-xs text-white/70">{d.label}</div>
                  <div className="text-lg font-semibold mt-0.5">{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Flat details */}
          <div className="lg:col-span-2 space-y-4">
            <Card title="Flat Information">
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: Building2, label: "Flat Number", value: data.flat_number },
                  { icon: Layers, label: "Block", value: data.block },
                  {
                    icon: Layers,
                    label: "Floor",
                    value: `${data.floor}${data.floor.endsWith("1") ? "st" : data.floor.endsWith("2") ? "nd" : data.floor.endsWith("3") ? "rd" : "th"} Floor`,
                  },
                  { icon: Maximize2, label: "Area", value: `${data.sqft} sq ft` },
                  { icon: Building2, label: "Type", value: data.type },
                  { icon: UserCheck, label: "Owner", value: data.owner_name },
                  { icon: Calendar, label: "Possession Date", value: data.since },
                  { icon: Users, label: "Occupancy", value: `${data.family_count} Members` },
                ].map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03]"
                  >
                    <span className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0">
                      <d.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[11px] text-muted-foreground">{d.label}</div>
                      <div className="text-sm font-medium">{d.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Amenities */}
            <Card title="Community Amenities">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {amenities.map((a) => (
                  <div
                    key={a.label}
                    className="rounded-xl glass p-4 hover:shadow-card transition flex items-start gap-3"
                  >
                    <div className="grid place-items-center h-10 w-10 rounded-lg bg-[image:var(--gradient-primary)] text-white shrink-0">
                      <a.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{a.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {/* Maintenance info */}
            <Card title="Maintenance Info">
              <div className="space-y-3">
                {[
                  { label: "Monthly Charge", value: latestBill ? `₹${latestBill.amount}` : "₹0" },
                  {
                    label: "Due Date",
                    value: latestBill?.due_date
                      ? new Date(latestBill.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "30th of month",
                  },
                  {
                    label: "Payment Status",
                    value: latestBill
                      ? latestBill.status.charAt(0).toUpperCase() + latestBill.status.slice(1)
                      : "No Bill",
                  },
                  {
                    label: "Last Billed On",
                    value: latestBill?.created_at
                      ? new Date(latestBill.created_at).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })
                      : "No bills yet",
                  },
                ].map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Parking info - REPLACES QUICK SUPPORT */}
            <Card title="My Parking Slot">
              <div className="rounded-xl bg-[image:var(--gradient-primary)] p-4 text-white shadow-elegant">
                <div className="flex items-center justify-between mb-4">
                  <div className="grid place-items-center h-10 w-10 rounded-lg bg-white/20 backdrop-blur-md">
                    <Car className="h-6 w-6" />
                  </div>
                  <Badge tone="muted">
                    {data.parking ? "Assigned" : "Unassigned"}
                  </Badge>
                </div>

                {data.parking ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-white/70">
                        Slot Number
                      </div>
                      <div className="text-3xl font-bold tracking-tight">
                        {data.parking.slot_number}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-white/10 p-2">
                          <div className="text-[9px] text-white/60 flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" /> Type
                          </div>
                          <div className="text-xs font-semibold">{data.parking.vehicle_type}</div>
                        </div>
                        <div className="rounded-lg bg-white/10 p-2">
                          <div className="text-[9px] text-white/60 flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" /> Plate
                          </div>
                          <div className="text-xs font-semibold">{data.parking.plate_number}</div>
                        </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-sm text-white/80">No parking slot assigned yet.</p>
                    <p className="text-[10px] text-white/60 mt-1">
                      Contact management to request a slot.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Family Members summary */}
            <Card title="Family Members">
              <div className="flex items-center gap-4 p-1">
                <div className="grid place-items-center h-12 w-12 rounded-full bg-foreground/5 text-primary">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-lg font-semibold">{data.family_count} Members</div>
                  <div className="text-xs text-muted-foreground">Registered under this flat</div>
                </div>
              </div>
            </Card>

            {/* Emergency Contacts - SUITABLE FOR FLAT PAGE */}
            <Card title="Emergency Contacts">
              <div className="space-y-3">
                {[
                  { label: "Security Gate", value: "+91 98765 43210" },
                  { label: "Maintenance", value: "+91 98765 43211" },
                  { label: "Facility Manager", value: "+91 98765 43212" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-medium text-primary cursor-pointer hover:underline">
                      {c.value}
                    </span>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-2 rounded-lg bg-foreground/5 border border-border text-[10px] font-medium hover:bg-foreground/10 transition uppercase tracking-wider">
                View All Contacts
              </button>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
