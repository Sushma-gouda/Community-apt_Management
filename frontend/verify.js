/**
 * VERIFICATION v2 — confirms register_resident works correctly
 * Run: node verify.js
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vckejkkswhyamhzccfiu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZja2Vqa2tzd2h5YW1oemNjZml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODcyODksImV4cCI6MjA5NDA2MzI4OX0.pk0ImqZvmZkcHZ5bigbqAMqhQp-3S8YmdqdzV1Ykd7o";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ok  = (m, v) => console.log(`  ✅ ${m}`, v !== undefined ? JSON.stringify(v) : "");
const err = (m, v) => console.log(`  ❌ ${m}`, v !== undefined ? JSON.stringify(v) : "");
const inf = (m, v) => console.log(`  ℹ️  ${m}`, v !== undefined ? JSON.stringify(v) : "");
const sep = (l)    => console.log(`\n${"=".repeat(60)}\n  ${l}\n${"=".repeat(60)}`);

// Always fresh unique email
const TEST_EMAIL = `verify_${Date.now()}_${Math.random().toString(36).slice(2,6)}@testflow.dev`;
const TEST_PASS  = "TestPass123!";

async function run() {
  sep("STEP 0 — Quick function check BEFORE signup");

  // Anon-call register_resident — expect "Not authenticated" (proves correct version)
  const { error: quickErr } = await supabase.rpc("register_resident", {
    p_flat_id: "flat-5e41bd4af388445192764ad0e467775e",
    p_full_name: "Quick Check",
    p_email: "quick@check.dev",
    p_phone: "0000000000",
    p_family_count: 1
  });
  if (!quickErr) {
    err("RPC returned data without auth — something is wrong");
  } else if (quickErr.message?.includes("occupancy_status")) {
    err("STILL USING OLD VERSION — fix_register_resident.sql was NOT applied in DB!", quickErr.message);
    err("→ Go to: https://supabase.com/dashboard/project/vckejkkswhyamhzccfiu/sql/new");
    err("→ Paste fix_register_resident.sql and click Run");
    process.exit(1);
  } else if (quickErr.message?.includes("Not authenticated")) {
    ok("register_resident is the CORRECT version (requires auth)");
  } else {
    inf("register_resident anon response:", quickErr.message);
  }

  sep(`STEP 1 — Sign up fresh test user\n  ${TEST_EMAIL}`);

  // Get a vacant flat
  const { data: flats } = await supabase.from("flats").select("id, flat_number, block_id").eq("status", "vacant").limit(1);
  if (!flats?.length) { err("No vacant flats available!"); return; }
  const flat = flats[0];
  ok("Vacant flat:", flat);

  // Sign up
  const { data: authData, error: signUpErr } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASS,
    options: {
      data: {
        role: "resident",
        full_name: "Verify Resident User",
        phone: "9111111111",
        block_id: flat.block_id,
        flat_number: flat.flat_number,
        flat_id: flat.id,
        family_count: "2"
      }
    }
  });

  if (signUpErr) { err("Signup failed:", signUpErr.message); return; }
  if (!authData.session) { err("No session — email confirmation may be required in Supabase Auth settings"); return; }
  ok("Auth user created:", authData.user.id);

  const userId = authData.user.id;
  const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  // Wait briefly for trigger
  await new Promise(r => setTimeout(r, 1000));

  sep("STEP 2 — Check profiles table (trigger)");
  const { data: prof } = await auth.from("profiles").select("role, flat_id, flat_number, full_name").eq("id", userId).maybeSingle();
  prof ? ok("Profile:", prof) : err("Profile NOT created!");

  sep("STEP 3 — Check residents table (trigger)");
  const { data: res } = await auth.from("residents").select("id, name, full_name, flat_id, user_id").eq("user_id", userId).maybeSingle();
  if (res) {
    ok("Resident created by TRIGGER:", res);
  } else {
    inf("Trigger did not create resident row — calling register_resident RPC...");

    sep("STEP 4 — Call register_resident RPC explicitly");
    const { data: rpcResult, error: rpcErr } = await auth.rpc("register_resident", {
      p_flat_id:      flat.id,
      p_full_name:    "Verify Resident User",
      p_email:        TEST_EMAIL,
      p_phone:        "9111111111",
      p_family_count: 2
    });

    if (rpcErr) {
      err("RPC FAILED:", rpcErr.message);
      if (rpcErr.message?.includes("occupancy_status")) {
        err("→ fix_register_resident.sql was NOT applied! Run it in Supabase SQL Editor.");
      }
    } else {
      ok("RPC succeeded:", rpcResult);
    }

    const { data: resAfter } = await auth.from("residents").select("id, name, full_name, flat_id").eq("user_id", userId).maybeSingle();
    resAfter ? ok("Resident created by RPC:", resAfter) : err("Resident STILL missing after RPC!");
  }

  sep("STEP 5 — Flat status check");
  const { data: flatAfter } = await supabase.from("flats").select("status, owner_name").eq("id", flat.id).maybeSingle();
  flatAfter?.status === "occupied" ? ok("Flat = occupied:", flatAfter) : err("Flat still vacant:", flatAfter);

  sep("STEP 6 — Function existence");
  for (const [fn, args] of [
    ["check_pre_registered_resident", { p_email: "x@x.dev" }],
    ["claim_resident_profile",        { p_email: "x@x.dev" }],
    ["update_my_resident_profile",    { p_name:  "X" }],
  ]) {
    const { error: e } = await auth.rpc(fn, args);
    if (!e || !e.message?.includes("Could not find")) ok(`${fn} EXISTS`);
    else err(`${fn} MISSING`);
  }

  await auth.auth.signOut();
  sep("CLEANUP");
  inf(`Delete test user: https://supabase.com/dashboard/project/vckejkkswhyamhzccfiu/auth/users`);
  inf(`Email: ${TEST_EMAIL}`);
}

run().catch(console.error);
