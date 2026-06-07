import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { UserPlus, CheckCircle2, Phone, Car, Building2, User, FileText, Users } from "lucide-react";
import { Card, DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { securityNav } from "@/components/dashboard/securityNav";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { createVisitorRequest } from "@/services/supabase/community";
import { supabase } from "@/services/supabase/client";

export const Route = createFileRoute("/dashboard/security/add-visitor")({
  head: () => ({ meta: [{ title: "Add Visitor — Communa Security" }] }),
  component: AddVisitor,
});

type VisitorType = "Guest" | "Delivery" | "Service" | "Cab";

function AddVisitor() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "success">("form");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    vehicle: "",
    resident_id: "",
    purpose: "Guest" as VisitorType,
    visitor_count: 1,
  });
  const [residents, setResidents] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('residents')
      .select('id, name, flats (flat_number, blocks(id, name))')
      .eq('status', 'active')
      .then(({ data }) => {
        if (data) {
          const sorted = data.sort((a: any, b: any) => {
            const blockA = a.flats?.blocks?.name || "";
            const blockB = b.flats?.blocks?.name || "";
            if (blockA !== blockB) return blockA.localeCompare(blockB);
            return (a.flats?.flat_number || "").localeCompare(b.flats?.flat_number || "");
          });
          setResidents(sorted);
        }
      });
  }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.resident_id) return;
    
    const resident = residents.find(r => r.id === form.resident_id);
    if (!resident) return;

    try {
      const { error } = await createVisitorRequest({
        name: form.name,
        phone: form.phone,
        purpose: form.purpose,
        visitor_count: form.visitor_count,
        vehicle: form.vehicle || undefined,
        resident_id: form.resident_id,
        block_id: resident.flats?.blocks?.id,
        flat_number: resident.flats?.flat_number,
        host_name: resident.name,
      });

      if (error) {
        alert("Failed to send request: " + error);
        return;
      }

      setStep("success");
      setTimeout(() => navigate({ to: "/dashboard/security" }), 2500);
    } catch (err: any) {
      alert("An unexpected error occurred: " + err.message);
    }
  };

  const purposeColors: Record<VisitorType, string> = {
    Guest: "var(--primary)",
    Delivery: "var(--warning)",
    Service: "var(--accent)",
    Cab: "var(--success)",
  };

  return (
    <DashboardLayout role="Security" items={securityNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader title="Add Visitor" subtitle="Register a new visitor and request resident approval." />

        <div className="max-w-2xl">
          {step === "form" && (
            <Card title="Visitor Information">
              <div className="space-y-4">
                {/* Visitor type */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Visitor Type</div>
                  <div className="grid grid-cols-4 gap-2">
                    {(["Guest", "Delivery", "Service", "Cab"] as VisitorType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, purpose: t })}
                        className={`h-10 rounded-xl text-xs font-medium transition border-2 ${
                          form.purpose === t
                            ? "border-transparent text-white shadow-elegant"
                            : "border-transparent bg-foreground/5 hover:bg-foreground/10"
                        }`}
                        style={
                          form.purpose === t
                            ? { background: `oklch(from ${purposeColors[t]} l c h)` }
                            : {}
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField
                    label="Visitor Name"
                    icon={<User className="h-4 w-4" />}
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    placeholder="Full name"
                    required
                  />
                  <FormField
                    label="Phone Number"
                    icon={<Phone className="h-4 w-4" />}
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    placeholder="+91 XXXXX XXXXX"
                    type="tel"
                    required
                  />
                  <div>
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">
                        Resident to Visit <span className="text-destructive">*</span>
                      </span>
                      <div className="mt-1.5 relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                          value={form.resident_id}
                          onChange={(e) => setForm({ ...form, resident_id: e.target.value })}
                          className="w-full h-10 pl-9 pr-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition"
                        >
                          <option value="">Select resident…</option>
                          {residents.map((r) => {
                            const label = `${r.flats?.blocks?.name || ""}-${r.flats?.flat_number || ""} (${r.name})`;
                            return (
                              <option key={r.id} value={r.id}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </label>
                  </div>
                  <FormField
                    label="Visitor Count"
                    icon={<Users className="h-4 w-4" />}
                    value={form.visitor_count.toString()}
                    onChange={(v) => setForm({ ...form, visitor_count: parseInt(v) || 1 })}
                    type="number"
                    required
                  />
                  <div className="sm:col-span-2">
                    <FormField
                      label="Vehicle Number"
                      icon={<Car className="h-4 w-4" />}
                      value={form.vehicle}
                      onChange={(v) => setForm({ ...form, vehicle: v })}
                      placeholder="MH-12 AB-1234 (optional - required for parking)"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={!form.name || !form.phone || !form.resident_id}
                    className="h-10 px-6 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-medium shadow-elegant hover:shadow-glow transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send Request to Resident
                  </button>
                </div>
              </div>
            </Card>
          )}

          {step === "success" && (
            <Card title="Request Sent">
              <div className="text-center py-8">
                <div className="mx-auto grid place-items-center h-20 w-20 rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)] mb-4 animate-scale-in">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="text-2xl font-semibold">Approval Request Sent!</div>
                <div className="text-sm text-muted-foreground mt-2">
                  {form.name}'s request has been sent to the resident.
                </div>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground/5 text-sm">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Redirecting to Dashboard…
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function FormField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <div className="mt-1.5 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 pl-9 pr-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>
    </label>
  );
}
