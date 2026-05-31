import { createFileRoute, Link, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  AuthLayout,
  Field,
  PasswordField,
  PrimaryButton,
  type Role,
} from "@/components/auth/AuthLayout";
import { supabase, isSupabaseConfigured } from "@/services/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";
import { useAuth } from "@/context/AuthContext";
import { dashboardPathForRole, getPostAuthRedirectPath } from "@/lib/auth-roles";
import {
  fetchBlocks,
  fetchVacantFlatsByBlock,
  registerResidentRpc,
  checkPreRegisteredResident,
  claimResidentProfile,
  type BlockRow,
  type FlatRow,
} from "@/services/supabase/community";

function Select({
  label,
  options,
  required,
  name,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  options: { value: string; label: string }[];
  required?: boolean;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-foreground/80 mb-1.5">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </div>
      <select
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-11 px-3 rounded-lg border border-input bg-background/50 text-sm
          focus:outline-none focus:ring-2 focus:ring-ring transition
          disabled:opacity-60 disabled:cursor-not-allowed
          aria-invalid:border-destructive aria-invalid:ring-destructive/30"
        aria-invalid={!!error}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </label>
  );
}

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create Account — Communa" }] }),
  component: SignUp,
});

const MIN_PASSWORD_LEN = 8;

function SignUp() {
  const [role, setRole] = useState<Role>("resident");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [blockId, setBlockId] = useState("");
  const [flatId, setFlatId] = useState("");
  const [familyCount, setFamilyCount] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [flatsLoading, setFlatsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [preRegisteredInfo, setPreRegisteredInfo] = useState<any>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const navigate = useNavigate();
  const { user, profile, initialized } = useAuth();

  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [flatsList, setFlatsList] = useState<FlatRow[]>([]);



  useEffect(() => {
    fetchBlocks()
      .then(setBlocks)
      .catch((err) => {
        console.error("Error fetching blocks:", err);
        setError("Failed to load available blocks. Please try again later.");
      })
      .finally(() => setBlocksLoading(false));
  }, []);

  useEffect(() => {
    if (blockId) {
      console.log(`[SignUp] Block selected: ${blockId}. Fetching flats...`);
      setFlatsLoading(true);
      fetchVacantFlatsByBlock(blockId)
        .then((flats) => {
          console.log(`[SignUp] Received ${flats.length} flats for block ${blockId}`);
          setFlatsList(flats);
        })
        .catch((err) => {
          console.error("Error fetching flats:", err);
          setError("Failed to load available flats for this block.");
          setFlatsList([]);
        })
        .finally(() => setFlatsLoading(false));
      setFlatId(""); // Reset flat selection
    } else {
      setFlatsList([]);
      setFlatId("");
    }
  }, [blockId]);

  // Check if the resident is pre-registered when the email changes
  useEffect(() => {
    if (role !== "resident") {
      setIsPreRegistered(false);
      setPreRegisteredInfo(null);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim();

    if (emailRegex.test(cleanEmail)) {
      setCheckingEmail(true);
      checkPreRegisteredResident(cleanEmail)
        .then((info) => {
          if (info && info.found) {
            console.log("[SignUp] Found pre-registered resident:", info);
            setIsPreRegistered(true);
            setPreRegisteredInfo(info);
            // Autofill fields
            setFullName(info.name);
            setPhone(info.phone || "");
            setBlockId(info.block_id);
            setFlatsList([{
              id: info.flat_id,
              block_id: info.block_id,
              flat_number: info.flat_number,
              floor: null,
              sqft: null,
              type: null,
              status: "occupied"
            }]);
            setFlatId(info.flat_id);
            setFamilyCount(String(info.family_count));
          } else {
            setIsPreRegistered(false);
            setPreRegisteredInfo(null);
          }
        })
        .catch((err) => {
          console.error("Error checking pre-registration:", err);
        })
        .finally(() => setCheckingEmail(false));
    } else {
      setIsPreRegistered(false);
      setPreRegisteredInfo(null);
    }
  }, [email, role]);

  if (initialized && user) {
    const dest = dashboardPathForRole(profile?.role || "resident");
    return <Navigate to={dest} />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    if (!isSupabaseConfigured) {
      setError(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env.",
      );
      return;
    }

    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }

    if (role !== "resident" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const newErrors: Record<string, string> = {};

    if (role === "resident") {
      if (!fullName.trim()) newErrors.fullName = "Full name is required";
      if (!email.trim()) newErrors.email = "Email is required";
      if (!phone.trim()) newErrors.phone = "Phone number is required";
      if (!blockId) newErrors.blockId = "Please select a block";
      if (!flatId) newErrors.flatId = "Please select a flat";
      if (!familyCount) newErrors.familyCount = "Family members count is required";

      if (Object.keys(newErrors).length > 0) {
        setValidationErrors(newErrors);
        return;
      }
    } else {
      if (!fullName.trim()) newErrors.fullName = "Full name is required";
      if (!email.trim()) newErrors.email = "Email is required";
      if (!password) newErrors.password = "Password is required";

      if (Object.keys(newErrors).length > 0) {
        setValidationErrors(newErrors);
        return;
      }
    }

    setLoading(true);
    try {
      const selectedFlat = flatsList.find((f) => f.id === flatId);
      const flatNumber = selectedFlat?.flat_number || "";

      const meta =
        role === "resident"
          ? {
              role,
              full_name: fullName.trim(),
              phone: phone.trim(),
              block_id: blockId,
              flat_number: flatNumber,
              flat_id: flatId,
              family_count: familyCount,
            }
          : {
              role,
              full_name: fullName.trim() || email.split("@")[0] || "User",
            };

      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: meta,
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
        },
      });

      if (signErr) {
        setError(formatAuthError(signErr, "signup"));
        return;
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError("An account with this email already exists. Try signing in instead.");
        return;
      }

      if (data.user && !data.session) {
        setError(
          "Check your email to confirm your account, then sign in. If email confirmation is disabled in Supabase, try signing in now.",
        );
        return;
      }

      if (data.user && data.session) {
        const fullNameForProfile =
          role === "resident" ? fullName.trim() : email.split("@")[0]?.trim() || "User";

        // Upsert profile — includes flat_id so profile is fully linked
        const { error: profileErr } = await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            role,
            full_name: fullNameForProfile,
            phone: role === "resident" ? phone.trim() : null,
            block_id: role === "resident" ? blockId : null,
            flat_number: role === "resident" ? flatNumber : null,
            flat_id: role === "resident" ? flatId : null,
            family_count: role === "resident" ? Number.parseInt(familyCount, 10) || null : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        if (profileErr) {
          console.error("[Supabase] profile upsert:", profileErr.message);
        }

        if (role === "resident") {
          if (isPreRegistered) {
            console.log("[SignUp] Linking to pre-registered profile via claimResidentProfile...");
            const { error: claimErr } = await claimResidentProfile(email.trim());
            if (claimErr) {
              console.error("[Supabase] claimResidentProfile error:", claimErr);
              setError(
                `Account created but profile mapping failed: ${claimErr}. ` +
                "Please sign in and contact admin to complete setup.",
              );
              return;
            }
          } else {
            // Register resident via RPC:
            //  • inserts into `residents` table with correct `name` column
            //  • marks flat as `occupied`
            //  • links resident to their profile
            const { error: regErr } = await registerResidentRpc({
              flatId: flatId,
              fullName: fullName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              familyCount: Number.parseInt(familyCount, 10),
            });

            if (regErr) {
              // Don't navigate — show the error so the user knows their account
              // was created but the flat assignment failed (e.g., flat was just taken)
              console.error("[Supabase] registerResidentRpc error:", regErr);
              if (regErr.includes("already exists")) {
                // Resident row already created (e.g. trigger ran first) — safe to proceed
                console.log("[Supabase] Resident already registered, proceeding.");
              } else {
                setError(
                  `Account created but flat assignment failed: ${regErr}. ` +
                  "Please sign in and contact admin to complete setup.",
                );
                return;
              }
            }
          }
        }

        const dest = await getPostAuthRedirectPath(data.user);
        navigate({ to: dest });
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join your community in under a minute"
      role={role}
      onRole={setRole}
      footer={
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link to="/signin" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {error && (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}
        {role === "resident" && (
          <>
            {isPreRegistered && (
              <div className="rounded-lg border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 px-4 py-3 text-sm text-[color:var(--success)] mb-2 animate-fade-up">
                <span className="font-semibold">Welcome back, {fullName}!</span> We found your pre-registered profile for <strong>Flat {preRegisteredInfo?.flat_number}</strong> in <strong>{preRegisteredInfo?.block_name}</strong>. Choose a password to activate your account.
              </div>
            )}
            <Field
              label="Full name"
              name="full_name"
              id="signup-full-name"
              required
              autoComplete="name"
              value={fullName}
              onChange={(ev) => {
                setFullName(ev.target.value);
                setValidationErrors({ ...validationErrors, fullName: "" });
              }}
              disabled={loading || isPreRegistered}
              error={validationErrors.fullName}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={checkingEmail ? "Email (Checking...)" : "Email"}
                type="email"
                name="email"
                id="signup-email"
                required
                autoComplete="email"
                value={email}
                onChange={(ev) => {
                  setEmail(ev.target.value);
                  setValidationErrors({ ...validationErrors, email: "" });
                }}
                disabled={loading}
                error={validationErrors.email}
              />
              <Field
                label="Phone"
                type="tel"
                name="phone"
                id="signup-phone"
                required
                autoComplete="tel"
                value={phone}
                onChange={(ev) => {
                  setPhone(ev.target.value);
                  setValidationErrors({ ...validationErrors, phone: "" });
                }}
                disabled={loading || isPreRegistered}
                error={validationErrors.phone}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Block"
                name="block_name"
                required
                options={blocks.map((b) => ({ value: b.id, label: b.name }))}
                value={blockId}
                onChange={(value) => {
                  setBlockId(value);
                  setValidationErrors({ ...validationErrors, blockId: "" });
                }}
                disabled={loading || blocksLoading || isPreRegistered}
                error={validationErrors.blockId}
              />
              <Select
                label="Flat"
                name="flat_id"
                required
                options={flatsList.map((f) => ({ value: f.id, label: `${f.flat_number}` }))}
                value={flatId}
                onChange={(value) => {
                  setFlatId(value);
                  setValidationErrors({ ...validationErrors, flatId: "" });
                }}
                disabled={loading || !blockId || flatsLoading || isPreRegistered}
                error={validationErrors.flatId}
              />
            </div>
            {blockId && flatsList.length === 0 && !flatsLoading && !isPreRegistered && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
                No vacant flats available in this block. Please select another block.
              </div>
            )}
            {flatsLoading && (
              <div className="p-3 rounded-lg bg-foreground/5 border border-border text-sm text-muted-foreground">
                Loading available flats...
              </div>
            )}
            <Field
              label="Family members"
              type="number"
              name="family_count"
              id="signup-family"
              required
              hint="Number of people in your household"
              value={familyCount}
              onChange={(ev) => {
                setFamilyCount(ev.target.value);
                setValidationErrors({ ...validationErrors, familyCount: "" });
              }}
              disabled={loading || isPreRegistered}
              error={validationErrors.familyCount}
            />
            <PasswordField
              required
              name="password"
              id="signup-password"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              disabled={loading}
              error={validationErrors.password}
            />
          </>
        )}
        {role !== "resident" && (
          <>
            <Field
              label="Full name"
              name="full_name"
              id="signup-full-name-alt"
              required
              autoComplete="name"
              value={fullName}
              onChange={(ev) => {
                setFullName(ev.target.value);
                setValidationErrors({ ...validationErrors, fullName: "" });
              }}
              disabled={loading}
              error={validationErrors.fullName}
            />
            <Field
              label="Email"
              type="email"
              name="email"
              id="signup-email-alt"
              required
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={loading}
            />
            <PasswordField
              required
              name="password"
              id="signup-password-alt"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              disabled={loading}
            />
            <PasswordField
              label="Confirm password"
              required
              name="confirm_password"
              id="signup-confirm"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
              disabled={loading}
            />
            <p className="text-[11px] text-muted-foreground">
              {role === "admin"
                ? "Admin accounts require approval from your community owner."
                : "Security accounts must be added by an administrator first."}
            </p>
          </>
        )}
        <PrimaryButton loading={loading} loadingLabel="Creating account…">
          Create Account
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}



