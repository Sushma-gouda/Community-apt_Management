import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vckejkkswhyamhzccfiu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZja2Vqa2tzd2h5YW1oemNjZml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODcyODksImV4cCI6MjA5NDA2MzI4OX0.pk0ImqZvmZkcHZ5bigbqAMqhQp-3S8YmdqdzV1Ykd7o";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("Testing RPC functions...");
  
  // Test 1: check_pre_registered_resident
  const { data: d1, error: e1 } = await supabase.rpc("check_pre_registered_resident", { p_email: "test@example.com" });
  if (e1) {
    console.error("❌ check_pre_registered_resident error:", e1.message, e1.code);
  } else {
    console.log("✅ check_pre_registered_resident exists! Result:", d1);
  }

  // Test 2: register_resident (we won't have auth, so we expect a 'Not authenticated' error, which shows the function exists!)
  const { data: d2, error: e2 } = await supabase.rpc("register_resident", {
    p_flat_id: "test-flat",
    p_full_name: "Test",
    p_email: "test@example.com",
    p_phone: "123",
    p_family_count: 1
  });
  if (e2) {
    console.log("register_resident result code:", e2.code, "message:", e2.message);
    if (e2.message.includes("Not authenticated")) {
      console.log("✅ register_resident exists (and correctly checked authentication)!");
    } else {
      console.error("❌ register_resident error:", e2.message);
    }
  } else {
    console.log("✅ register_resident result:", d2);
  }

  // Test 3: update_my_resident_profile
  const { data: d3, error: e3 } = await supabase.rpc("update_my_resident_profile", {
    p_name: "Test Name"
  });
  if (e3) {
    console.log("update_my_resident_profile result code:", e3.code, "message:", e3.message);
  } else {
    console.log("✅ update_my_resident_profile exists!");
  }
}

run();
