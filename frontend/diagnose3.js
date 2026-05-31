/**
 * TRIGGER FAILURE DIAGNOSIS
 * Checks what exactly causes the new trigger to throw.
 * Run: node diagnose3.js
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vckejkkswhyamhzccfiu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZja2Vqa2tzd2h5YW1oemNjZml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODcyODksImV4cCI6MjA5NDA2MzI4OX0.pk0ImqZvmZkcHZ5bigbqAMqhQp-3S8YmdqdzV1Ykd7o";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ok  = (m, v) => console.log(`  ✅ ${m}`, v !== undefined ? JSON.stringify(v) : "");
const err = (m, v) => console.log(`  ❌ ${m}`, v !== undefined ? JSON.stringify(v) : "");
const inf = (m, v) => console.log(`  ℹ️  ${m}`, v !== undefined ? JSON.stringify(v, null, 2) : "");

async function run() {
  console.log("\n=== PROFILES TABLE: checking flat_id column type ===");
  // Try inserting a TEXT flat_id into profiles via upsert
  const fakeUid = "00000000-0000-0000-0000-000000000001";
  const { error: profileTestErr } = await supabase.from("profiles").upsert({
    id: fakeUid,
    role: "resident",
    full_name: "Column Type Test",
    flat_id: "flat-5e41bd4af388445192764ad0e467775e"  // TEXT value
  }, { onConflict: "id" });

  if (profileTestErr) {
    if (profileTestErr.message?.includes("invalid input syntax") || profileTestErr.message?.includes("uuid")) {
      err("profiles.flat_id is UUID type but we're inserting TEXT — TYPE MISMATCH!", profileTestErr.message);
    } else if (profileTestErr.message?.includes("policy")) {
      inf("Blocked by RLS (expected), but no type error — flat_id type is OK:", profileTestErr.message);
    } else {
      inf("profiles upsert error:", profileTestErr.message, `code=${profileTestErr.code}`);
    }
  } else {
    ok("profiles accepts TEXT flat_id value — type is compatible");
    // clean up
    await supabase.from("profiles").delete().eq("id", fakeUid);
  }

  console.log("\n=== RESIDENTS TABLE: column types check ===");
  // Check if residents.flat_id FK is text or uuid
  const { error: resTestErr } = await supabase.from("residents").insert({
    id: "res-diag-type-check",
    flat_id: "flat-5e41bd4af388445192764ad0e467775e",
    name: "Type Check",
    full_name: "Type Check",
    email: "typecheck@test.com",
    phone: null,
    family_count: 1,
    status: "active",
    user_id: null
  });
  if (resTestErr) {
    if (resTestErr.message?.includes("policy")) {
      ok("Residents insert correctly blocked by RLS as anon — schema is valid:", resTestErr.message);
    } else {
      err("Residents insert schema error:", resTestErr.message, `code=${resTestErr.code}`);
    }
  } else {
    ok("Insert succeeded (unexpected for anon)");
    await supabase.from("residents").delete().eq("id", "res-diag-type-check");
  }

  console.log("\n=== FLATS TABLE: check status column ===");
  const { data: flatData, error: flatErr } = await supabase
    .from("flats").select("id, status, owner_name").limit(3);
  if (flatErr) err("flats query failed:", flatErr.message);
  else inf("Flats with status column:", flatData);

  console.log("\n=== ACTUAL TRIGGER SOURCE (via pg_proc) ===");
  // We can't query pg_proc directly, but we can check if functions exist
  for (const fn of ["register_resident", "handle_new_user", "check_pre_registered_resident", "claim_resident_profile", "update_my_resident_profile"]) {
    const { error: fnErr } = await supabase.rpc(fn, fn === "register_resident"
      ? { p_flat_id: "x", p_full_name: "x", p_email: "x", p_phone: "x", p_family_count: 1 }
      : fn === "handle_new_user" ? {} 
      : fn === "check_pre_registered_resident" ? { p_email: "x" }
      : fn === "claim_resident_profile" ? { p_email: "x" }
      : { p_name: "x" }
    );
    if (!fnErr) ok(`${fn}: EXISTS`);
    else if (fnErr.code === "PGRST202") err(`${fn}: MISSING`);
    else if (fnErr.code === "PGRST203") err(`${fn}: DUPLICATE OVERLOAD`);
    else ok(`${fn}: EXISTS (error is expected: ${fnErr.message?.substring(0, 60)})`);
  }

  console.log("\n=== RPC: register_resident test as anon ===");
  const { error: rpcTestErr } = await supabase.rpc("register_resident", {
    p_flat_id: "flat-5e41bd4af388445192764ad0e467775e",
    p_full_name: "Test",
    p_email: "test@test.com",
    p_phone: "999",
    p_family_count: 1
  });
  if (rpcTestErr) {
    if (rpcTestErr.message?.includes("Not authenticated")) ok("register_resident: Requires auth correctly:", rpcTestErr.message);
    else if (rpcTestErr.message?.includes("occupancy_status")) err("register_resident: STILL USING OLD COLUMN — fix_db.sql not applied!", rpcTestErr.message);
    else if (rpcTestErr.code === "PGRST203") err("register_resident: DUPLICATE OVERLOAD!", rpcTestErr.message);
    else err("register_resident: unexpected error:", rpcTestErr.message);
  } else {
    inf("register_resident returned data (unexpected)");
  }
}

run().catch(console.error);
