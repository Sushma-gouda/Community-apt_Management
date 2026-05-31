import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vckejkkswhyamhzccfiu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZja2Vqa2tzd2h5YW1oemNjZml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODcyODksImV4cCI6MjA5NDA2MzI4OX0.pk0ImqZvmZkcHZ5bigbqAMqhQp-3S8YmdqdzV1Ykd7o";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("Inspecting database...");

  // Let's run a query to get database function handle_new_user
  const { data, error } = await supabase.rpc("exec_sql", {
    sql: `
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name = 'handle_new_user';
    `
  });

  if (error) {
    console.error("Error inspecting routines:", error.message);
  } else {
    console.log("Function 'handle_new_user' definition:", JSON.stringify(data, null, 2));
  }

  // Let's see if there are any residents rows
  const { data: resData, error: resError } = await supabase.from("residents").select("*").limit(5);
  if (resError) {
    console.error("Error reading residents:", resError.message);
  } else {
    console.log("Residents data:", resData);
  }

  // Let's see if there are any profiles rows
  const { data: profData, error: profError } = await supabase.from("profiles").select("*").limit(5);
  if (profError) {
    console.error("Error reading profiles:", profError.message);
  } else {
    console.log("Profiles data:", profData);
  }

  // Let's see flats status
  const { data: flatsData, error: flatsError } = await supabase.from("flats").select("*").limit(5);
  if (flatsError) {
    console.error("Error reading flats:", flatsError.message);
  } else {
    console.log("Flats data:", flatsData);
  }
}

run();
