import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { Camera, Mail, Phone, Building2, Users, Calendar, Edit3, Save, X } from "lucide-react";
import { Card, DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { residentNav } from "@/components/dashboard/residentNav";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { fetchMyProfile, updateMyProfile } from "@/services/supabase/community";

export const Route = createFileRoute("/dashboard/resident/profile")({
  head: () => ({ meta: [{ title: "My Profile — Communa" }] }),
  component: ResidentProfile,
});

type Profile = {
  name: string;
  email: string;
  phone: string;
  altPhone: string;
  flat: string;
  block: string;
  floor: string;
  sqft: string;
  familyCount: string;
  since: string;
  bio: string;
  id_suffix: string;
};

function ResidentProfile() {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);

  async function load() {
    setLoading(true);
    try {
      const p = await fetchMyProfile();
      if (p) {
        const mapped: Profile = {
          // `p.name` is the actual DB column from `residents.name`
          name: p.name ?? "",
          email: p.email ?? "",
          phone: p.phone || "",
          altPhone: "",
          flat: p.flat_number,
          block: p.block_name,
          floor: String(p.floor),
          sqft: String(p.sqft),
          familyCount: String(p.family_count || 1),
          since: p.created_at
            ? new Date(p.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
            : "—",
          bio: "",
          id_suffix: p.id ? String(p.id).slice(-4).toUpperCase() : "0000",
        };
        setProfile(mapped);
        setDraft(mapped);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!draft) return;
    setLoading(true);
    try {
      // `name` is the actual column in the `residents` table (not `full_name`)
      const { error } = await updateMyProfile({
        name: draft.name,
        phone: draft.phone,
        family_count: parseInt(draft.familyCount) || 1,
      });
      if (error) {
        alert("Error saving: " + error);
      } else {
        setProfile(draft);
        setEditing(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  if (loading && !profile) {
    return (
      <DashboardLayout role="Resident" items={residentNav}>
        <div className="py-20 text-center text-muted-foreground animate-pulse">Loading your profile...</div>
      </DashboardLayout>
    );
  }

  if (!profile || !draft) return null;

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <DashboardLayout role="Resident" items={residentNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="My Profile"
          subtitle="Manage your personal information and flat details."
          actions={
            editing ? (
              <div className="flex gap-2">
                <button
                  onClick={cancel}
                  className="inline-flex h-10 px-4 items-center gap-2 rounded-lg glass text-sm font-medium hover:bg-foreground/5 transition"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button
                  onClick={save}
                  className="inline-flex h-10 px-4 items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-medium shadow-elegant hover:shadow-glow transition"
                >
                  <Save className="h-4 w-4" /> Save Changes
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex h-10 px-4 items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-medium shadow-elegant hover:shadow-glow transition"
              >
                <Edit3 className="h-4 w-4" /> Edit Profile
              </button>
            )
          }
        />

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Avatar card */}
          <div className="lg:col-span-1">
            <Card title="Profile Photo">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative">
                  <div className="h-28 w-28 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center text-white text-4xl font-semibold shadow-elegant">
                    {initials}
                  </div>
                  {editing && (
                    <button className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-card border-2 border-background grid place-items-center shadow-card hover:bg-foreground/5 transition">
                      <Camera className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xl font-semibold">{profile.name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {profile.flat} · {profile.block}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Resident since {profile.since}
                  </div>
                </div>
                <div className="w-full rounded-xl bg-[image:var(--gradient-primary)] p-4 text-white text-center">
                  <div className="text-xs text-white/70 uppercase tracking-widest">Resident ID</div>
                  <div className="text-lg font-semibold mt-1">
                    RES-{profile.since.split(" ").pop()}-{profile.id_suffix}
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick stats */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Family Members", value: profile.familyCount, icon: Users },
                { label: "Floor", value: profile.floor, icon: Building2 },
                { label: "Area", value: `${profile.sqft} sqft`, icon: Building2 },
                { label: "Since", value: profile.since.split(" ").pop() || "—", icon: Calendar },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl glass shadow-card p-4 text-center">
                  <s.icon className="h-5 w-5 mx-auto text-primary mb-2" />
                  <div className="text-lg font-semibold">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-4">
            <Card title="Personal Information">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  label="Full Name"
                  icon={<Users className="h-4 w-4" />}
                  value={draft.name}
                  editing={editing}
                  onChange={(v) => setDraft({ ...draft, name: v })}
                />
                <FormField
                  label="Email Address"
                  icon={<Mail className="h-4 w-4" />}
                  value={draft.email}
                  editing={editing}
                  onChange={(v) => setDraft({ ...draft, email: v })}
                  type="email"
                />
                <FormField
                  label="Phone Number"
                  icon={<Phone className="h-4 w-4" />}
                  value={draft.phone}
                  editing={editing}
                  onChange={(v) => setDraft({ ...draft, phone: v })}
                  type="tel"
                />
                <FormField
                  label="Alternate Phone"
                  icon={<Phone className="h-4 w-4" />}
                  value={draft.altPhone}
                  editing={editing}
                  onChange={(v) => setDraft({ ...draft, altPhone: v })}
                  type="tel"
                />
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">Bio</span>
                    <div className="mt-1.5">
                      {editing ? (
                        <textarea
                          value={draft.bio}
                          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2.5 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition resize-none"
                        />
                      ) : (
                        <div className="px-3 py-2.5 text-sm rounded-lg bg-foreground/[0.03] text-foreground/80">
                          {profile.bio}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </Card>

            <Card title="Flat Details">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  label="Flat Number"
                  icon={<Building2 className="h-4 w-4" />}
                  value={draft.flat}
                  editing={false}
                  onChange={() => {}}
                />
                <FormField
                  label="Block"
                  icon={<Building2 className="h-4 w-4" />}
                  value={draft.block}
                  editing={false}
                  onChange={() => {}}
                />
                <FormField
                  label="Floor"
                  icon={<Building2 className="h-4 w-4" />}
                  value={draft.floor}
                  editing={false}
                  onChange={() => {}}
                />
                <FormField
                  label="Area (sqft)"
                  icon={<Building2 className="h-4 w-4" />}
                  value={draft.sqft}
                  editing={false}
                  onChange={() => {}}
                />
                <FormField
                  label="Family Members"
                  icon={<Users className="h-4 w-4" />}
                  value={draft.familyCount}
                  editing={editing}
                  onChange={(v) => setDraft({ ...draft, familyCount: v })}
                  type="number"
                />
                <FormField
                  label="Resident Since"
                  icon={<Calendar className="h-4 w-4" />}
                  value={draft.since}
                  editing={false}
                  onChange={() => {}}
                />
              </div>
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                Flat number, block, and floor details can only be changed by the admin.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function FormField({
  label,
  icon,
  value,
  editing,
  onChange,
  type = "text",
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {editing ? (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        ) : (
          <div className="w-full h-10 pl-9 pr-3 text-sm rounded-lg bg-foreground/[0.03] flex items-center text-foreground/80">
            {value}
          </div>
        )}
      </div>
    </label>
  );
}
