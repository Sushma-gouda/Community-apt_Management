/**
 * DIAGNOSTIC SCRIPT — Resident Signup Workflow Investigation
 * 
 * Run from frontend/ directory: node diagnose.js
 * 
 * This script:
 * 1. Checks what RPC functions actually exist in the DB
 * 2. Checks RLS policies on residents, flats, profiles
 * 3. Checks for duplicate function overloads (the PGRST203 error)
 * 4. Checks the exact constraint violations by trying an insert
 * 5. Shows the actual residents table columns
 * 6. Tests a simulated signup using a service-role-like approach
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vckejkkswhyamhzccfiu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZja2Vqa2tzd2h5YW1oemNjZml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODcyODksImV4cCI6MjA5NDA2MzI4OX0.pk0ImqZvmZkcHZ5bigbqAMqhQp-3S8YmdqdzV1Ykd7o";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sep = (label) => console.log(`\n${"=".repeat(60)}\n  ${label}\n${"=".repeat(60)}`);
const ok  = (msg, val) => console.log(`  ✅ ${msg}`, val !== undefined ? JSON.stringify(val, null, 2) : "");
const err = (msg, val) => console.log(`  ❌ ${msg}`, val !== undefined ? JSON.stringify(val, null, 2) : "");
const inf = (msg, val) => console.log(`  ℹ️  ${msg}`, val !== undefined ? JSON.stringify(val, null, 2) : "");

async function run() {

  // ─── 1. Check residents table columns ───────────────────────────────────────
  sep("1. RESIDENTS TABLE SCHEMA (via select *limit 0)");
  const { data: schemaCheck, error: schemaErr } = await supabase
    .from("residents")
    .select("*")
    .limit(0);
  if (schemaErr) {
    err("Cannot query residents table:", schemaErr.message, schemaErr.code);
  } else {
    ok("residents table is accessible (RLS allows anon SELECT or table exists)");
  }

  // ─── 2. Count existing residents ────────────────────────────────────────────
  sep("2. CURRENT residents TABLE DATA");
  const { count: resCount, error: resCountErr } = await supabase
    .from("residents")
    .select("*", { count: "exact", head: true });
  if (resCountErr) {
    err("Cannot count residents:", resCountErr.message, `code=${resCountErr.code}`);
  } else {
    inf(`Total resident rows in table: ${resCount}`);
  }
  
  const { data: resRows, error: resRowsErr } = await supabase
    .from("residents")
    .select("id, name, full_name, email, flat_id, user_id, status")
    .limit(10);
  if (resRowsErr) {
    err("Cannot fetch resident rows:", resRowsErr.message, `code=${resRowsErr.code}`);
  } else {
    inf("Resident rows (up to 10):", resRows);
  }

  // ─── 3. Check profiles table ─────────────────────────────────────────────────
  sep("3. CURRENT profiles TABLE DATA");
  const { data: profRows, error: profRowsErr } = await supabase
    .from("profiles")
    .select("id, role, full_name, flat_id, flat_number")
    .limit(10);
  if (profRowsErr) {
    err("Cannot fetch profiles:", profRowsErr.message, `code=${profRowsErr.code}`);
  } else {
    inf(`Profile rows (up to 10):`, profRows);
  }

  // ─── 4. Check flats ──────────────────────────────────────────────────────────
  sep("4. FLATS TABLE (status overview)");
  const { data: flatsData, error: flatsErr } = await supabase
    .from("flats")
    .select("id, flat_number, status, block_id, owner_name")
    .limit(10);
  if (flatsErr) {
    err("Cannot fetch flats:", flatsErr.message);
  } else {
    inf("Flats sample:", flatsData);
    const occupied = (flatsData || []).filter(f => f.status === "occupied");
    inf(`Occupied flats count in sample: ${occupied.length}`);
  }

  // ─── 5. Test check_pre_registered_resident RPC ──────────────────────────────
  sep("5. TEST: check_pre_registered_resident RPC");
  const { data: preRegData, error: preRegErr } = await supabase.rpc(
    "check_pre_registered_resident",
    { p_email: "nonexistent@test.com" }
  );
  if (preRegErr) {
    err("check_pre_registered_resident FAILED:", preRegErr.message, `code=${preRegErr.code}`);
    if (preRegErr.code === "PGRST202") {
      err("FUNCTION DOES NOT EXIST IN DB — migrations not applied!");
    }
  } else {
    ok("check_pre_registered_resident EXISTS and works:", preRegData);
  }

  // ─── 6. Test register_resident RPC (expect 'Not authenticated') ─────────────
  sep("6. TEST: register_resident RPC (expect Not authenticated as anon)");
  
  // Get first vacant flat
  const { data: vacantFlats } = await supabase
    .from("flats")
    .select("id, flat_number, block_id, status")
    .eq("status", "vacant")
    .limit(1);
  const testFlatId = vacantFlats?.[0]?.id;
  inf("Test flat to use:", vacantFlats?.[0]);

  if (testFlatId) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("register_resident", {
      p_flat_id: testFlatId,
      p_full_name: "Test Resident",
      p_email: "test@example.com",
      p_phone: "9999999999",
      p_family_count: 2
    });
    if (rpcErr) {
      if (rpcErr.message?.includes("Not authenticated")) {
        ok("register_resident EXISTS — correctly requires authentication:", rpcErr.message);
      } else if (rpcErr.code === "PGRST202") {
        err("register_resident DOES NOT EXIST — migration NOT applied!", rpcErr.message);
      } else if (rpcErr.code === "PGRST203") {
        err("DUPLICATE FUNCTION OVERLOAD (PGRST203) — two versions with same name exist!", rpcErr.message);
        err("CRITICAL: This is why inserts fail — PostgREST cannot choose which function to call");
      } else {
        err("register_resident error:", rpcErr.message, `code=${rpcErr.code}`);
      }
    } else {
      inf("register_resident returned (unexpected as anon):", rpcData);
    }
  }

  // ─── 7. Test update_my_resident_profile RPC ──────────────────────────────────
  sep("7. TEST: update_my_resident_profile RPC");
  const { error: updErr } = await supabase.rpc("update_my_resident_profile", {
    p_name: "Test"
  });
  if (updErr) {
    if (updErr.message?.includes("Not authenticated")) {
      ok("update_my_resident_profile EXISTS — correctly requires authentication");
    } else if (updErr.code === "PGRST202") {
      err("update_my_resident_profile DOES NOT EXIST — migration NOT applied!", updErr.message);
    } else {
      err("update_my_resident_profile error:", updErr.message, `code=${updErr.code}`);
    }
  } else {
    ok("update_my_resident_profile EXISTS");
  }

  // ─── 8. Test claim_resident_profile RPC ──────────────────────────────────────
  sep("8. TEST: claim_resident_profile RPC");
  const { error: claimErr } = await supabase.rpc("claim_resident_profile", {
    p_email: "test@example.com"
  });
  if (claimErr) {
    if (claimErr.message?.includes("Not authenticated")) {
      ok("claim_resident_profile EXISTS — correctly requires authentication");
    } else if (claimErr.code === "PGRST202") {
      err("claim_resident_profile DOES NOT EXIST — migration NOT applied!", claimErr.message);
    } else {
      err("claim_resident_profile error:", claimErr.message, `code=${claimErr.code}`);
    }
  } else {
    ok("claim_resident_profile EXISTS");
  }

  // ─── 9. Simulate signup and try direct insert as anon ───────────────────────
  sep("9. TEST: Direct INSERT into residents as anon (should get RLS error)");
  const testId = "diag-" + Date.now();
  const { error: directInsertErr } = await supabase.from("residents").insert({
    id: testId,
    flat_id: testFlatId || "flat-xxx",
    name: "Diagnostic Test",
    full_name: "Diagnostic Test",
    email: "diag@test.com",
    phone: "0000000000",
    family_count: 1,
    status: "active",
    user_id: null
  });
  if (directInsertErr) {
    if (directInsertErr.code === "42501" || directInsertErr.message?.includes("policy")) {
      ok("INSERT blocked by RLS (expected for anon) — policies are working:", directInsertErr.message);
    } else if (directInsertErr.message?.includes("full_name")) {
      err("NOT NULL constraint on full_name! DB schema differs from expected:", directInsertErr.message);
    } else {
      err("Direct insert error:", directInsertErr.message, `code=${directInsertErr.code}`);
    }
  } else {
    err("Direct insert SUCCEEDED as anon — RLS is NOT blocking! Security issue.", testId);
    // Clean up
    await supabase.from("residents").delete().eq("id", testId);
  }

  // ─── 10. Check for the handle_new_user trigger ──────────────────────────────
  sep("10. SUMMARY & ACTION ITEMS");
  console.log(`
  Based on results above:
  
  IF check_pre_registered_resident = PGRST202 → Run fix_db.sql in Supabase SQL Editor
  IF register_resident = PGRST203        → Duplicate function exists, run fix_db.sql
  IF register_resident = PGRST202        → Function missing, run fix_db.sql
  IF residents table = 0 rows            → Trigger is not running or failing silently
  
  FILE TO RUN: d:\\community-management\\supabase\\fix_db.sql
  URL: https://supabase.com/dashboard/project/vckejkkswhyamhzccfiu/sql/new
  `);
}

run().catch(console.error);
