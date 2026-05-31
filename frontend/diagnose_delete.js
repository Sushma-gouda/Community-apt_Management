import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vckejkkswhyamhzccfiu.supabase.co";
// Using anon key to login as the admin, or we can just use the service role key to test if it's an RLS issue or FK issue.
// Let's use the service role key from the .env if possible, but since we don't have it explicitly, we can just login.

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZja2Vqa2tzd2h5YW1oemNjZml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODcyODksImV4cCI6MjA5NDA2MzI4OX0.pk0ImqZvmZkcHZ5bigbqAMqhQp-3S8YmdqdzV1Ykd7o";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDelete() {
  console.log("Fetching residents...");
  const { data: residents, error: fetchErr } = await supabase.from("residents").select("id").limit(1);
  
  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    return;
  }
  
  if (!residents || residents.length === 0) {
    console.log("No residents found to delete. Creating a mock resident...");
    // Let's not create one yet.
    return;
  }

  const resId = residents[0].id;
  console.log(`Trying to delete resident: ${resId} (as ANON)`);
  
  // This will fail due to RLS, but we can check if it returns an error or just 0 rows.
  const { data, error } = await supabase.from("residents").delete().eq("id", resId).select();
  
  console.log("Delete response error:", error);
  console.log("Delete response data:", data);

  // Let's check if the delete policy exists.
  // We can't query pg_policies via REST, but we can call an RPC if we had one.
}

testDelete();
