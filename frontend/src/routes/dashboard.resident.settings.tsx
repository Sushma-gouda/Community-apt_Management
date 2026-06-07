import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { User, Bell, Palette, Lock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Card, DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { residentNav } from "@/components/dashboard/residentNav";
import { Field, GhostButton, PageHeader, PrimaryButton, TextInput } from "@/components/dashboard/PageHeader";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/services/supabase/client";
import { updateMyProfile } from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/resident/settings")({
  head: () => ({ meta: [{ title: "Settings - Communa Resident" }] }),
  component: ResidentSettings,
});

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-elegant text-white text-sm font-medium animate-scale-in ${type === "success" ? "bg-green-600" : "bg-destructive"}`}>
      {type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {message}
    </div>
  );
}

function ResidentSettings() {
  const { theme, toggle } = useTheme();
  const { user, profile, residentHome, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"account" | "notifications" | "security" | "appearance">("account");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Profile form state
  const resident = residentHome?.resident;
  const flat = residentHome?.flat;
  const block = residentHome?.block;
  
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [familyCount, setFamilyCount] = useState("1");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  // Password form state
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    setFullName(resident?.full_name || resident?.name || profile?.full_name || user?.email?.split("@")[0] || "");
    setPhone(resident?.phone || profile?.phone || "");
    setAltPhone(resident?.alt_phone || "");
    setFamilyCount(resident?.family_count?.toString() || "1");
    setBio(resident?.bio || "");
  }, [resident, profile, user]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await updateMyProfile({
      name: fullName,
      phone: phone,
      alt_phone: altPhone,
      family_count: parseInt(familyCount) || 1,
      bio: bio,
    });
    setSaving(false);
    if (error) {
      showToast("Failed to save: " + error, "error");
    } else {
      await refreshProfile();
      showToast("Profile saved successfully!", "success");
    }
  };

  const handleChangePassword = async () => {
    if (!newPwd || !confirmPwd) return showToast("Please fill in all password fields.", "error");
    if (newPwd !== confirmPwd) return showToast("New passwords do not match.", "error");
    if (newPwd.length < 6) return showToast("Password must be at least 6 characters.", "error");
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdSaving(false);
    if (error) {
      showToast("Password update failed: " + error.message, "error");
    } else {
      setNewPwd(""); setConfirmPwd("");
      showToast("Password updated successfully!", "success");
    }
  };

  const email = user?.email || resident?.email || "-";
  const flatLabel = flat ? `${flat.flat_number} - Block ${block?.name || "-"}` : "-";
  const residentSince = resident?.created_at
    ? new Date(resident.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "-";
  const residentId = resident?.id ? `RES-${resident.id.slice(-4).toUpperCase()}` : "-";

  const tabs = [
    { id: "account", label: "Account", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Lock },
    { id: "appearance", label: "Appearance", icon: Palette },
  ] as const;

  return (
    <DashboardLayout role="Resident" items={residentNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader title="Settings" subtitle="Manage your account preferences." />

        <div className="grid lg:grid-cols-[220px_1fr] gap-4">
          {/* Sidebar */}
          <nav className="rounded-2xl glass shadow-card p-2 h-fit">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  tab === t.id ? "bg-[image:var(--gradient-primary)] text-white shadow-elegant" : "text-foreground/75 hover:bg-foreground/5"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="space-y-4">
            {/* --- ACCOUNT TAB --- */}
            {tab === "account" && (
              <Card title="Account Information">
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <Field label="Full Name">
                    <TextInput value={fullName} onChange={(e: any) => setFullName(e.target.value)} placeholder="Your full name" />
                  </Field>
                  <Field label="Email Address">
                    <TextInput value={email} readOnly className="opacity-60 cursor-not-allowed" />
                  </Field>
                  <Field label="Phone Number">
                    <TextInput value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </Field>
                  <Field label="Alternate Phone">
                    <TextInput value={altPhone} onChange={(e: any) => setAltPhone(e.target.value)} placeholder="Optional" />
                  </Field>
                  <Field label="Family Members">
                    <TextInput type="number" min="1" value={familyCount} onChange={(e: any) => setFamilyCount(e.target.value)} />
                  </Field>
                  <Field label="Bio / About">
                    <TextInput value={bio} onChange={(e: any) => setBio(e.target.value)} placeholder="A short bio" />
                  </Field>
                </div>

                {/* Read-only info */}
                <div className="bg-foreground/[0.02] rounded-xl p-4 border border-border/50 grid sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Flat Details</span>
                    <span className="text-sm font-semibold">{flatLabel}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Resident Since</span>
                    <span className="text-sm font-semibold">{residentSince}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Resident ID</span>
                    <span className="text-sm font-semibold text-primary">{residentId}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex justify-end gap-2">
                  <GhostButton onClick={() => {
                    setFullName(resident?.full_name || resident?.name || "");
                    setPhone(resident?.phone || "");
                    setAltPhone(resident?.alt_phone || "");
                    setFamilyCount(resident?.family_count?.toString() || "1");
                    setBio(resident?.bio || "");
                  }}>Cancel</GhostButton>
                  <PrimaryButton onClick={handleSaveProfile} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </PrimaryButton>
                </div>
              </Card>
            )}

            {/* --- NOTIFICATIONS TAB --- */}
            {tab === "notifications" && (
              <Card title="Notification Preferences">
                <p className="text-sm text-muted-foreground mb-4">Configure which notifications you receive. Preferences are saved locally on this device.</p>
                <div className="space-y-2">
                  {[
                    { id: "notices", label: "New Notices", desc: "Get notified about community announcements", defaultOn: true },
                    { id: "bills", label: "Bill Reminders", desc: "Reminders for upcoming bill payments", defaultOn: true },
                    { id: "complaints", label: "Complaint Updates", desc: "Status updates on your complaints", defaultOn: true },
                    { id: "visitors", label: "Visitor Alerts", desc: "Notifications when visitors arrive", defaultOn: true },
                    { id: "email", label: "Email Digest", desc: "Weekly summary via email", defaultOn: false },
                  ].map((n) => (
                    <Toggle key={n.id} id={`pref_res_${n.id}`} label={n.label} desc={n.desc} defaultOn={n.defaultOn} />
                  ))}
                </div>
              </Card>
            )}

            {/* --- SECURITY TAB --- */}
            {tab === "security" && (
              <Card title="Security Settings">
                <p className="text-sm text-muted-foreground mb-4">Set a new password for your account.</p>
                <div className="grid sm:grid-cols-2 gap-3 mb-5">
                  <Field label="New Password">
                    <TextInput type="password" value={newPwd} onChange={(e: any) => setNewPwd(e.target.value)} placeholder="Min. 6 characters" />
                  </Field>
                  <Field label="Confirm New Password">
                    <TextInput type="password" value={confirmPwd} onChange={(e: any) => setConfirmPwd(e.target.value)} placeholder="Repeat new password" />
                  </Field>
                </div>
                <div className="pt-2">
                  <Toggle id="pref_res_2fa" label="Two-factor authentication" desc="Add an extra layer of security" defaultOn={false} />
                </div>
                <div className="flex justify-end pt-4 mt-4 border-t border-border">
                  <PrimaryButton onClick={handleChangePassword} disabled={pwdSaving}>
                    {pwdSaving ? "Updating..." : "Update Password"}
                  </PrimaryButton>
                </div>
              </Card>
            )}

            {/* --- APPEARANCE TAB --- */}
            {tab === "appearance" && (
              <Card title="Appearance">
                <div className="grid sm:grid-cols-2 gap-3">
                  {(["light", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { if (t !== theme) toggle(); }}
                      className={`text-left rounded-2xl p-4 border-2 transition ${
                        theme === t ? "border-primary shadow-elegant" : "border-transparent glass hover:border-border"
                      }`}
                    >
                      <div className={`h-24 rounded-xl mb-3 ${t === "dark" ? "bg-[oklch(0.14_0.025_260)]" : "bg-[oklch(0.985_0.005_240)] border border-border"}`} />
                      <div className="text-sm font-semibold capitalize">{t} mode</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t === "dark" ? "Easier on the eyes at night" : "Bright and clean for daytime"}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </DashboardLayout>
  );
}

function Toggle({ id, label, desc, defaultOn }: { id: string; label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(() => {
    const saved = localStorage.getItem(id);
    if (saved !== null) return saved === "true";
    return !!defaultOn;
  });

  useEffect(() => {
    localStorage.setItem(id, on.toString());
  }, [on, id]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/[0.03]">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative h-6 w-11 rounded-full transition ${on ? "bg-[image:var(--gradient-primary)]" : "bg-foreground/15"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
