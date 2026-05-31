/**
 * DEEP DIAGNOSTIC — Tests what the actual register_resident function does
 * by signing up a real test user and tracing every step.
 * 
 * Run: node diagnose2.js
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vckejkkswhyamhzccfiu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZja2Vqa2tzd2h5YW1oemNjZml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODcyODksImV4cCI6MjA5NDA2MzI4OX0.pk0ImqZvmZkcHZ5bigbqAMqhQp-3S8YmdqdzV1Ykd7o";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sep = (l) => console.log(`\n${"=".repeat(60)}\n  ${l}\n${"=".repeat(60)}`);
const ok  = (m, v) => console.log(`  ✅ ${m}`, v !== undefined ? JSON.stringify(v, null, 2) : "");
const err = (m, v) => console.log(`  ❌ ${m}`, v !== undefined ? JSON.stringify(v, null, 2) : "");
const inf = (m, v) => console.log(`  ℹ️  ${m}`, v !== undefined ? JSON.stringify(v, null, 2) : "");

const TEST_EMAIL = `diagnose_${Date.now()}@testflow.dev`;
const TEST_PASS  = "TestPass123!";

async function run() {
  // ─── 0. Find a vacant flat to use ───────────────────────────────────────────
  sep("0. SETUP — Get a vacant flat");
  const { data: flats } = await supabase.from("flats").select("id, flat_number, block_id, status").eq("status", "vacant").limit(1);
  if (!flats?.length) { err("No vacant flats! Cannot test."); return; }
  const testFlat = flats[0];
  ok("Using flat:", testFlat);

  // ─── 1. Sign up a new user ───────────────────────────────────────────────────
  sep(`1. AUTH — Sign up test user: ${TEST_EMAIL}`);
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASS,
    options: {
      data: {
        role: "resident",
        full_name: "Diag Resident Test",
        phone: "9876543210",
        block_id: testFlat.block_id,
        flat_number: testFlat.flat_number,
        flat_id: testFlat.id,
        family_count: "2"
      }
    }
  });

  if (signUpErr) {
    err("signUp FAILED:", signUpErr.message);
    return;
  }
  ok("signUp succeeded:", { user_id: signUpData.user?.id, has_session: !!signUpData.session });

  if (!signUpData.session) {
    err("No session — email confirmation is required. Cannot test further.");
    err("→ Go to Supabase → Auth → Email Templates → Disable confirm email OR check Supabase Auth settings.");
    return;
  }

  const userId = signUpData.user.id;
  const session = signUpData.session;

  // Create authenticated client
  const authedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } }
  });

  // ─── 2. Check if trigger created profiles row ────────────────────────────────
  sep("2. TRIGGER CHECK — Did handle_new_user create a profiles row?");
  await new Promise(r => setTimeout(r, 1000)); // wait 1s for trigger
  const { data: profileRow, error: profileErr } = await authedSupabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) err("profiles query error:", profileErr.message);
  else if (profileRow) ok("profiles row created by trigger:", profileRow);
  else err("profiles row NOT created by trigger — handle_new_user trigger may not be running!");

  // ─── 3. Check if trigger created residents row ───────────────────────────────
  sep("3. TRIGGER CHECK — Did handle_new_user create a residents row?");
  const { data: residentRow, error: residentErr } = await authedSupabase
    .from("residents")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (residentErr) err("residents query error:", residentErr.message);
  else if (residentRow) ok("residents row CREATED BY TRIGGER:", residentRow);
  else {
    err("residents row NOT created by trigger");
    err("This means handle_new_user trigger either:");
    err("  a) Is using the OLD version (without full_name insert)");
    err("  b) Is throwing an exception internally (swallowed)");
    err("  c) Is not attached to auth.users");
  }

  // ─── 4. Check flat status after trigger ──────────────────────────────────────
  sep("4. FLAT STATUS — Did trigger update flat to occupied?");
  const { data: flatAfter } = await supabase.from("flats").select("id, status, owner_name").eq("id", testFlat.id).maybeSingle();
  inf("Flat status after signup:", flatAfter);
  if (flatAfter?.status === "occupied") ok("Flat marked as occupied by trigger");
  else err("Flat still vacant — trigger did NOT update flat status");

  // ─── 5. Call register_resident RPC explicitly ────────────────────────────────
  sep("5. RPC TEST — Explicitly call register_resident as authenticated user");
  const { data: rpcResult, error: rpcErr } = await authedSupabase.rpc("register_resident", {
    p_flat_id: testFlat.id,
    p_full_name: "Diag Resident Test",
    p_email: TEST_EMAIL,
    p_phone: "9876543210",
    p_family_count: 2
  });

  if (rpcErr) {
    if (rpcErr.message?.includes("already exists")) {
      ok("RPC returned 'already exists' — trigger created it first (correct!):", rpcErr.message);
    } else if (rpcErr.message?.includes("not available")) {
      err("RPC says flat not available — flat was occupied by trigger but RPC doesn't use idempotent check:", rpcErr.message);
    } else if (rpcErr.code === "PGRST203") {
      err("DUPLICATE FUNCTION OVERLOAD — two register_resident functions exist in DB!", rpcErr.message);
    } else if (rpcErr.code === "PGRST202") {
      err("register_resident function NOT FOUND!", rpcErr.message);
    } else {
      err("RPC error:", rpcErr.message, `code=${rpcErr.code}, details=${rpcErr.details}`);
    }
  } else {
    ok("RPC succeeded:", rpcResult);
  }

  // ─── 6. Check residents table after RPC ─────────────────────────────────────
  sep("6. FINAL STATE — residents table");
  const { data: finalRes } = await authedSupabase.from("residents").select("*").eq("user_id", userId);
  inf("Resident rows for this user:", finalRes);

  // ─── 7. Sign out and cleanup ─────────────────────────────────────────────────
  sep("7. CLEANUP");
  await authedSupabase.auth.signOut();
  inf(`Test email used: ${TEST_EMAIL}`);
  inf("Delete this test user from Supabase Auth dashboard if needed.");
  inf("URL: https://supabase.com/dashboard/project/vckejkkswhyamhzccfiu/auth/users");
}

run().catch(console.error);
