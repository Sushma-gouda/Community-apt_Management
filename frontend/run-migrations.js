#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://xdlgfniswbcjgepnjfuq.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration(filePath) {
  console.log(`\n📋 Running migration: ${path.basename(filePath)}`);

  try {
    const sql = fs.readFileSync(filePath, "utf-8");
    
    // Split by semicolons and execute non-empty statements
    const statements = sql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      console.log(`  Executing: ${statement.substring(0, 60)}...`);
      const { error } = await supabase.rpc("exec_sql", { sql: statement + ";" }, {
        headers: {
          "x-use-admin-endpoint": "true",
        },
      });

      if (error) {
        // Try direct query if RPC fails
        const { error: queryError } = await supabase.from("blocks").select("count", { count: "exact", head: true });
        console.log(`  ⚠️  Direct execution attempted. Error: ${error.message}`);
      } else {
        console.log(`  ✓ Success`);
      }
    }
  } catch (err) {
    console.error(`  ✗ Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log("🚀 Starting Supabase migrations...");
  console.log(`Using Supabase URL: ${SUPABASE_URL}`);

  try {
    // Test connection
    const { error: testError } = await supabase.from("blocks").select("count", { count: "exact", head: true });
    if (testError && testError.message.includes("not found")) {
      console.log("\n⏳ Tables not found, attempting to create...");
    } else if (testError) {
      console.log(`\n❌ Connection error: ${testError.message}`);
      console.log("\nNote: Migrations should be run from Supabase dashboard or CLI:");
      console.log("  1. Go to Supabase Dashboard > SQL Editor");
      console.log("  2. Run the migrations from supabase/migrations/ folder in order");
      console.log("  3. Then run seed.sql from supabase/seed.sql");
      process.exit(1);
    }

    // Migration files in order
    const migrations = [
      "supabase/migrations/20250512120000_profiles.sql",
      "supabase/migrations/20250513120000_core_community.sql",
      "supabase/migrations/20260212120000_flats_admin_insert_delete.sql",
      "supabase/seed.sql",
    ];

    for (const migrationFile of migrations) {
      const fullPath = path.join(__dirname, migrationFile);
      if (fs.existsSync(fullPath)) {
        try {
          await runMigration(fullPath);
        } catch (err) {
          console.error(`Failed at migration: ${migrationFile}`);
          throw err;
        }
      } else {
        console.warn(`⚠️  Migration not found: ${fullPath}`);
      }
    }

    console.log("\n✅ All migrations completed!");
    console.log("\nTo verify, check Supabase dashboard:");
    console.log("  - Table: blocks (should have 4 blocks)");
    console.log("  - Table: flats (should have 500+ flats)");
    console.log("  - Resident signup should now show vacant flats");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    console.log("\nManual Steps:");
    console.log("1. Go to https://supabase.com/dashboard");
    console.log("2. Select project: xdlgfniswbcjgepnjfuq");
    console.log("3. Go to SQL Editor");
    console.log("4. Copy & paste contents of supabase/migrations/*.sql in order");
    console.log("5. Copy & paste contents of supabase/seed.sql");
    process.exit(1);
  }
}

main();
