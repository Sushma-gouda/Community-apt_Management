import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase/client";

const supabaseAdminClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export type BlockRow = { id: string; name: string; total_flats: number };

/** Row from `public.flats` (matches core migration). */
export type FlatRow = {
  id: string;
  block_id: string;
  flat_number: string;
  floor: number | null;
  sqft: number | null;
  type: string | null;
  /** `vacant` | `occupied` | `reserved` */
  status: string;
  owner_name?: string | null;
  created_at?: string | null;
};

/** Flat list row with resolved block label for tables. */
export type FlatWithBlockName = FlatRow & { block_name: string };
export type ResidentRow = {
  id: string;
  user_id?: string | null;
  /** DB column is `name` — full_name is a duplicate column in DB, both are set on insert */
  name: string;
  full_name: string;
  email: string;
  phone?: string | null;
  flat_id: string;
  family_count?: number | null;
  status?: string;
  created_at?: string;
};
export type ComplaintRow = {
  id: number | string; // Handle both BigInt and UUID
  resident_id: string | null;
  title: string;
  description: string | null; // Match actual DB schema
  status: string;
  flat_label: string | null;
  category: string | null;
  priority: string | null;
  created_at: string;
};
/**
 * Matches public.bills schema with added fields
 */
export type BillRow = {
  id: string | number;
  resident_id: string | null;
  label: string | null;
  amount: number;
  status: "pending" | "paid" | "overdue" | "unpaid";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  payment_method?: string | null;
  transaction_id?: string | null;
};
export type VisitorRow = {
  id: string;
  name: string;
  phone: string | null;
  flat_id: string | null;
  purpose: string;
  vehicle_number: string | null;
  entry_time: string;
  exit_time: string | null;
};
export type NoticeRow = {
  id: string;
  title: string;
  body: string | null;
  target_block: string;
  tag: string | null;
  pinned: boolean;
  published_at: string;
};
export type ParkingSlotRow = {
  id: string;
  slot_number: string;
  level: string | null;
  zone: string | null;
  type: string | null;
  status: string;
  flat_id: string | null;
};
export type MaintenanceAssetRow = {
  id: number;
  name: string;
  category: string;
  location: string;
  last_service_on: string | null;
  next_service_on: string | null;
  health_score: number;
  status: string;
};

export async function fetchBlocks(): Promise<BlockRow[]> {
  const { data, error } = await supabase.from("blocks").select("*").order("name");
  return error ? [] : (data as BlockRow[]) || [];
}

export async function fetchVacantFlatsByBlock(blockId: string): Promise<FlatRow[]> {
  const { data, error } = await supabase.from("flats").select("*").eq("block_id", blockId).or("status.ilike.vacant,status.is.null").order("flat_number");
  return error ? [] : (data as FlatRow[]) || [];
}

export async function fetchResidentByUserId(userId: string): Promise<{ resident: ResidentRow; flat: FlatRow; block: BlockRow; } | null> {
  const { data: res, error: e1 } = await supabase
    .from("residents")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (e1 || !res) return null;

  const { data: row, error: e2 } = await supabase
    .from("flats")
    .select(`*, blocks:block_id ( id, name, total_flats )`)
    .eq("id", res.flat_id)
    .maybeSingle();
  if (e2 || !row) return null;

  const flatData = row as any;
  // blocks join returns a single object (not array)
  const block: BlockRow = flatData.blocks && !Array.isArray(flatData.blocks)
    ? flatData.blocks
    : Array.isArray(flatData.blocks) && flatData.blocks.length > 0
      ? flatData.blocks[0]
      : { id: flatData.block_id, name: "N/A", total_flats: 0 };

  // Strip the nested blocks object from the flat row
  const { blocks: _b, ...flatRest } = flatData;
  return { resident: res as ResidentRow, flat: flatRest as FlatRow, block };
}

export async function registerResidentRpc(args: { flatId: string; fullName: string; email: string; phone: string; familyCount: number; }): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("register_resident", { p_flat_id: args.flatId, p_full_name: args.fullName, p_email: args.email, p_phone: args.phone, p_family_count: args.familyCount });
  return error ? { error: error.message } : { error: null };
}

export async function adminResidentCount(): Promise<number> {
  const { count, error } = await supabase.from("residents").select("*", { count: "exact", head: true });
  return error ? 0 : count ?? 0;
}

export async function adminFlatsOccupancy(): Promise<{ total: number; occupied: number }> {
  const { data, error } = await supabase.from("flats").select("status");
  if (error || !data) return { total: 0, occupied: 0 };
  return { total: data.length, occupied: data.filter((f) => f.status === "occupied").length };
}

export async function adminComplaintStats(): Promise<{ open: number }> {
  const { data, error } = await supabase.from("complaints").select("status");
  if (error || !data) return { open: 0 };
  return { open: data.filter((c) => c.status === "open" || c.status === "in_progress").length };
}

export async function adminUnpaidBillsTotal(): Promise<number> {
  const { data, error } = await supabase.from("bills").select("amount, status").in("status", ["pending", "unpaid"]);
  if (error || !data) return 0;
  return data.reduce((s, b) => s + Number(b.amount), 0);
}

export async function adminActiveVisitorCount(): Promise<number> {
  const { count, error } = await supabase.from("visitors").select("*", { count: "exact", head: true }).is("exit_time", null);
  return error ? 0 : count ?? 0;
}

export async function fetchRecentComplaints(limit: number): Promise<ComplaintRow[]> {
  const { data, error } = await supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(limit);
  return error ? [] : (data as ComplaintRow[]) ?? [];
}

/** Fire-and-forget overdue updater — does NOT block page loads */
function triggerOverdueUpdate(): void {
  const today = new Date().toISOString().split("T")[0];
  supabase
    .from("bills")
    .update({ status: "overdue" })
    .in("status", ["pending", "unpaid"])
    .lt("due_date", today)
    .then(
      () => {},
      (err) => console.warn("Failed to silently trigger overdue update:", err)
    );
}

export async function updateOverdueBills(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await supabase.from("bills").update({ status: "overdue" }).in("status", ["pending", "unpaid"]).lt("due_date", today);
}

export async function fetchRecentBills(limit: number): Promise<BillRow[]> {
  triggerOverdueUpdate();
  const { data, error } = await supabase.from("bills").select("*").order("created_at", { ascending: false }).limit(limit);
  return error ? [] : (data as BillRow[]) ?? [];
}

export async function fetchBillsAll(): Promise<BillRow[]> {
  triggerOverdueUpdate();
  const { data, error } = await supabase.from("bills").select("*").order("created_at", { ascending: false });
  return error ? [] : (data as BillRow[]) ?? [];
}

/** Fetch all bills with joined flat + resident + block info for rich admin display. */
export type BillDetailed = BillRow & {
  flat_number: string;
  block_name: string;
  resident_name: string;
};

export async function fetchBillsAllDetailed(): Promise<BillDetailed[]> {
  triggerOverdueUpdate();

  const [billsRes, flatsRes, residentsRes] = await Promise.all([
    supabase
      .from("bills")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("flats")
      .select("id, flat_number, block_id, owner_name, blocks:block_id(name)"),
    supabase
      .from("residents")
      .select("id, full_name, flat_id"),
  ]);

  const bills = (billsRes.data ?? []) as BillRow[];
  const flats = flatsRes.data ?? [];
  const residents = residentsRes.data ?? [];

  return bills.map((b) => {
    const res = residents.find((r) => r.id === b.resident_id);
    const f = flats.find((fl) => fl.id === res?.flat_id);
    const bObj = Array.isArray(f?.blocks) ? f.blocks[0] : f?.blocks;

    return {
      ...b,
      status: b.status === "unpaid" ? "pending" : b.status,
      flat_number: f?.flat_number ?? "Unknown",
      block_name: bObj?.name ?? "Unknown",
      resident_name: res?.full_name ?? f?.owner_name ?? "Unknown",
    };
  });
}

export async function fetchBillsForResident(residentId: string): Promise<BillRow[]> {
  triggerOverdueUpdate();
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });
  return error ? [] : (data as BillRow[]) ?? [];
}

export async function createBill(args: {
  resident_id: string;
  amount: number;
  due_date: string;
  label?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("bills").insert({
    resident_id: args.resident_id,
    amount:  args.amount,
    due_date: args.due_date,
    status:  "pending",
    label:   args.label ?? "Maintenance",
  });
  return error ? { error: error.message } : { error: null };
}

export async function createBillsBulk(args: {
  target: "all" | string;
  amount: number;
  due_date: string;
  label?: string;
}): Promise<{ count: number; error: string | null }> {
  // 1. Fetch flats for the target block (or all)
  let query = supabase.from("flats").select("id, block_id, status");
  if (args.target !== "all") query = query.eq("block_id", args.target);
  const { data: allFlats, error: flatErr } = await query;

  if (flatErr) {
    console.error("[billing] flats fetch error:", flatErr.message);
    return { count: 0, error: flatErr.message };
  }

  // 2. Filter occupied flats
  const occupied = (allFlats ?? []).filter(
    (f) => String(f.status).toLowerCase() === "occupied"
  );

  if (occupied.length === 0) {
    return {
      count: 0,
      error: "No occupied flats found for the selected target. Register at least one resident first.",
    };
  }

  const flatIds = occupied.map(f => f.id);
  const { data: residentsData, error: resErr } = await supabase
    .from("residents")
    .select("id, flat_id")
    .in("flat_id", flatIds);
    
  if (resErr) {
    return { count: 0, error: "Failed to fetch residents for flats: " + resErr.message };
  }
  
  const residents = residentsData || [];
  
  if (residents.length === 0) {
    return { count: 0, error: "No active residents found in the selected flats." };
  }

  // 3. Build insert rows for bills mapped to resident_id
  const rows = residents.map((r) => ({
    resident_id: r.id,
    amount:   args.amount,
    due_date: args.due_date,
    status:   "pending" as const,
    label:    args.label ?? "Maintenance",
  }));

  // 4. Insert
  const { error: insertErr } = await supabase.from("bills").insert(rows);

  if (insertErr) {
    console.error("[billing] insert error:", insertErr.message, insertErr.details);
    return { count: 0, error: insertErr.message };
  }

  return { count: rows.length, error: null };
}

export async function payBill(args: { bill_id: string | number }): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("bills")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", args.bill_id)
    .select();

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Unauthorized or bill not found. Please try again." };
  
  return { error: null };
}

export async function fetchRecentVisitors(limit: number): Promise<VisitorDetailed[]> {
  const all = await fetchVisitorsDetailed();
  return all.slice(0, limit);
}

export async function fetchVisitorsAll(): Promise<VisitorDetailed[]> {
  return fetchVisitorsDetailed();
}

export async function fetchNotices(limit: number): Promise<NoticeRow[]> {
  const { data, error } = await supabase.from("notices").select("*").order("published_at", { ascending: false }).limit(limit);
  return error ? [] : (data as NoticeRow[]) ?? [];
}

export async function fetchResidentsDetailed(): Promise<Array<ResidentRow & { flat_number: string; block_name: string }>> {
  const { data, error } = await supabase
    .from("residents")
    // Select both columns: `full_name` (NOT NULL) and `name` (nullable)
    .select(`id, name, full_name, email, phone, flat_id, family_count, status, user_id, created_at,
             flats:flat_id ( flat_number, blocks:block_id (name) )`)
    .order("full_name");  // order by the NOT NULL column
  if (error) {
    console.error("[residents] fetchResidentsDetailed error:", error.message);
    return [];
  }
  return (data as any[]).map((r) => ({
    ...r,
    // Normalize: use full_name (NOT NULL), fall back to name
    name:       r.full_name || r.name || "Unknown",
    full_name:  r.full_name || r.name || "Unknown",
    flat_number: r.flats?.flat_number ?? "N/A",
    block_name:  r.flats?.blocks?.name ?? "N/A",
  }));
}

export async function fetchResidentsDirectory(): Promise<Array<ResidentRow & { flat_number: string; block_name: string }>> {
  return fetchResidentsDetailed();
}

export async function fetchFlatsWithBlocks() {
  const { data, error } = await supabase
    .from("flats")
    .select(`*, blocks:block_id (id, name)`)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[flats] fetchFlatsWithBlocks error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function insertFlat(args: { block_id: string; flat_number: string; floor: number | null; sqft: number | null; owner_name?: string | null; type?: string | null; }) {
  // Generate a unique ID since `flats.id` is `text primary key` with no DB default
  const newId = "flat-" + crypto.randomUUID().replace(/-/g, "");
  const { error } = await supabase.from("flats").insert({
    id: newId,
    block_id: args.block_id,
    flat_number: args.flat_number,
    floor: args.floor,
    sqft: args.sqft,
    type: args.type ?? null,
    status: "vacant",
    owner_name: args.owner_name ?? null,
    created_at: new Date().toISOString(),
  });
  return error ? { error: error.message } : { error: null };
}

export async function updateFlat(id: string, args: Partial<FlatRow>): Promise<{ error: string | null }> {
  const payload: any = { ...args };
  if (payload.status) payload.status = String(payload.status).toLowerCase();
  const { error } = await supabase.from("flats").update(payload).eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function deleteFlat(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("flats").delete().eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function fetchComplaintsAll(): Promise<ComplaintRow[]> {
  const { data, error } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
  return error ? [] : (data as ComplaintRow[]) ?? [];
}

export async function fetchComplaintsForResident(residentId: string): Promise<ComplaintRow[]> {
  const { data, error } = await supabase.from("complaints").select("*").eq("resident_id", residentId).order("created_at", { ascending: false });
  return error ? [] : (data as ComplaintRow[]) ?? [];
}

export async function createComplaint(args: {
  resident_id: string;
  title: string;
  body: string;
  flat_label?: string;
  priority?: string;
  category?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("complaints").insert({
    resident_id: args.resident_id,
    title: args.title,
    description: args.body,
    flat_label: args.flat_label,
    status: "open",
    category: args.category || "General",
    priority: (args.priority || "medium").toLowerCase(),
  });
  return error ? { error: error.message } : { error: null };
}

export async function updateComplaintStatus(id: string, status: string): Promise<{ error: string | null }> {
  const dbStatus = status === "pending" ? "open" : status === "in-progress" ? "in_progress" : status;
  const { error } = await supabase.from("complaints").update({ status: dbStatus, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function updateComplaintPriority(id: string, priority: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("complaints").update({ priority: priority.toLowerCase(), updated_at: new Date().toISOString() }).eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function fetchMyProfile(): Promise<(ResidentRow & { flat_number: string; block_name: string; floor: number; sqft: number; type: string; owner_name: string }) | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: resident, error } = await supabase
    .from("residents")
    // Select both name and full_name — full_name is the NOT NULL column
    .select(`id, name, full_name, email, phone, flat_id, family_count, status, user_id, created_at,
             flats:flat_id ( id, flat_number, floor, sqft, type, owner_name, blocks:block_id (name) )`)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[fetchMyProfile] error:", error.message);
    return null;
  }
  if (!resident) {
    console.warn("[fetchMyProfile] no resident row found for user:", user.id);
    return null;
  }

  const f = (resident as any).flats;
  const displayName = (resident as any).full_name || resident.name || "Resident";
  return {
    ...(resident as ResidentRow),
    // Normalize: prefer full_name (NOT NULL) for display
    name:        displayName,
    full_name:   displayName,
    flat_number: f?.flat_number ?? "N/A",
    block_name:  f?.blocks?.name ?? "N/A",
    floor:       f?.floor ?? 0,
    sqft:        f?.sqft ?? 0,
    type:        f?.type ?? "Not specified",
    owner_name:  f?.owner_name ?? "—",
  };
}


export async function updateMyProfile(args: {
  name?: string;
  phone?: string;
  family_count?: number | null;
}): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Use the security-definer RPC so residents can update their own row
  // (direct update is blocked by RLS for non-admins)
  const { error } = await supabase.rpc("update_my_resident_profile", {
    p_name:         args.name          ?? null,
    p_phone:        args.phone         ?? null,
    p_family_count: args.family_count  ?? null,
  });

  return error ? { error: error.message } : { error: null };
}

export async function deleteResident(id: string, flatId?: string): Promise<{ error: string | null }> {
  // Use the robust RPC to ensure atomic deletion and flat status update
  const { error } = await supabase.rpc("admin_remove_resident", {
    p_res_id: id,
    p_flat_id: flatId || null
  });
  
  return error ? { error: error.message } : { error: null };
}

export async function updateResident(id: string, args: Partial<ResidentRow>): Promise<{ error: string | null }> {
  const payload = { ...args };
  // Keep full_name in sync with name
  if (payload.name) {
    payload.full_name = payload.name;
  }
  const { error } = await supabase.from("residents").update(payload).eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function adminCreateResident(args: {
  flatId: string;
  fullName: string;
  email: string;
  phone: string;
  familyCount: number;
  password?: string;
  blockId?: string;
  flatNumber?: string;
}): Promise<{ error: string | null }> {
  if (args.password) {
    const { error: signUpErr } = await supabaseAdminClient.auth.signUp({
      email: args.email,
      password: args.password,
      options: {
        data: {
          role: "resident",
          full_name: args.fullName,
          phone: args.phone,
          flat_id: args.flatId,
          block_id: args.blockId || "",
          flat_number: args.flatNumber || "",
          family_count: args.familyCount.toString(),
        }
      }
    });
    return signUpErr ? { error: signUpErr.message } : { error: null };
  }

  const residentId = "res-" + Math.random().toString(36).substring(2, 11);

  // 1. Insert into residents table — BOTH `name` AND `full_name` required (full_name is NOT NULL)
  const { error: resErr } = await supabase.from("residents").insert({
    id: residentId,
    flat_id: args.flatId,
    name: args.fullName,
    full_name: args.fullName,
    email: args.email,
    phone: args.phone,
    family_count: args.familyCount,
    status: "active",
    user_id: null,
  });

  if (resErr) {
    console.error("[adminCreateResident] insert error:", resErr.message);
    return { error: resErr.message };
  }

  // 2. Update flat status to occupied
  const { error: flatErr } = await supabase
    .from("flats")
    .update({ status: "occupied", owner_name: args.fullName })
    .eq("id", args.flatId);

  if (flatErr) {
    await supabase.from("residents").delete().eq("id", residentId);
    return { error: flatErr.message };
  }

  return { error: null };
}

export async function checkPreRegisteredResident(email: string): Promise<{
  found: boolean;
  resident_id: string;
  flat_id: string;
  flat_number: string;
  block_id: string;
  block_name: string;
  name: string;
  phone: string;
  family_count: number;
} | null> {
  const { data, error } = await supabase.rpc("check_pre_registered_resident", { p_email: email });
  if (error || !data) return null;
  return data as any;
}

export async function claimResidentProfile(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("claim_resident_profile", { p_email: email });
  return error ? { error: error.message } : { error: null };
}


export type ParkingDetailed = {
  id: string; // uuid
  flat_id: string; // text — matches flats.id
  slot_number: string;
  vehicle_type: "Car" | "Bike" | "EV";
  vehicle_model: string | null;
  plate_number: string;
  allocated_at: string;
  flat_number: string;
  block_name: string;
  resident_name: string;
};

export async function fetchParkingAll(): Promise<ParkingSlotRow[]> {
  const { data, error } = await supabase.from("parking").select("*");
  return error ? [] : (data as ParkingSlotRow[]) ?? [];
}

export async function fetchParkingAllDetailed(): Promise<ParkingDetailed[]> {
  const [parkingRes, flatsRes, residentsRes] = await Promise.all([
    supabase
      .from("parking")
      .select("*")
      .order("allocated_at", { ascending: false }),
    supabase
      .from("flats")
      .select("id, flat_number, block_id, owner_name, blocks:block_id(name)"),
    supabase
      .from("residents")
      // DB has both `name` and `full_name` columns; prefer full_name then fall back to name
      .select("flat_id, name, full_name"),
  ]);

  if (parkingRes.error) {
    console.error("[parking] SELECT error:", parkingRes.error.message);
    return [];
  }

  const parking = (parkingRes.data ?? []) as any[];
  const flats = (flatsRes.data ?? []) as any[];
  const residents = (residentsRes.data ?? []) as any[];

  const flatMap = new Map<string, any>(flats.map((f) => [String(f.id), f]));
  const residentMap = new Map<string, any>(residents.map((r) => [String(r.flat_id), r]));

  return parking.map((p) => {
    const flat = flatMap.get(String(p.flat_id));
    const resident = residentMap.get(String(p.flat_id));
    return {
      id: p.id,
      flat_id: String(p.flat_id), // keep as text
      slot_number: p.slot_number,
      vehicle_type: p.vehicle_type,
      vehicle_model: p.vehicle_model,
      plate_number: p.plate_number,
      allocated_at: p.allocated_at,
      flat_number: flat?.flat_number ?? "N/A",
      block_name: flat?.blocks?.name ?? "N/A",
      resident_name: resident?.full_name ?? resident?.name ?? flat?.owner_name ?? "—",
    };
  });
}

export async function adminParkingStats(): Promise<{ total: number; occupied: number; available: number }> {
  const { data, error } = await supabase.from("parking").select("id");
  if (error || !data) return { total: 0, occupied: 0, available: 40 };
  const occupied = data.length;
  const total = 40; // fixed slot grid size
  return { total, occupied, available: total - occupied };
}

export async function fetchResidentParking(): Promise<ParkingDetailed[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: resident, error: resErr } = await supabase
    .from("residents")
    .select("flat_id, full_name, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (resErr || !resident) return [];

  // flat_id is text — use it directly
  const flatId = String(resident.flat_id);

  const [parkingRes, flatsRes] = await Promise.all([
    supabase
      .from("parking")
      .select("*")
      .eq("flat_id", flatId),
    supabase
      .from("flats")
      .select("id, flat_number, owner_name, blocks:block_id(name)")
      .eq("id", flatId)
      .maybeSingle(),
  ]);

  if (parkingRes.error || !parkingRes.data) return [];

  const parkingList = parkingRes.data as any[];
  const flat = flatsRes.data as any;
  const residentName = resident.full_name || resident.name || flat?.owner_name || "—";

  return parkingList.map((p) => ({
    id: p.id,
    flat_id: String(p.flat_id),
    slot_number: p.slot_number,
    vehicle_type: p.vehicle_type,
    vehicle_model: p.vehicle_model,
    plate_number: p.plate_number,
    allocated_at: p.allocated_at,
    flat_number: flat?.flat_number ?? "N/A",
    block_name: flat?.blocks?.name ?? "N/A",
    resident_name: residentName,
  }));
}

export async function assignParkingSlot(args: {
  flat_id: string;
  slot_number: string;
  vehicle_type: string;
  vehicle_model?: string;
  plate_number: string;
}): Promise<{ error: string | null }> {
  // flat_id is text — use directly, no numeric conversion
  const { error } = await supabase.from("parking").insert({
    flat_id: String(args.flat_id),
    slot_number: args.slot_number,
    vehicle_type: args.vehicle_type,
    vehicle_model: args.vehicle_model || null,
    plate_number: args.plate_number,
  });
  return error ? { error: error.message } : { error: null };
}

export async function updateParkingSlot(
  id: string,
  args: {
    vehicle_type: string;
    vehicle_model?: string;
    plate_number: string;
    flat_id?: string;
    slot_number?: string;
  }
): Promise<{ error: string | null }> {
  const payload: any = {
    vehicle_type: args.vehicle_type,
    vehicle_model: args.vehicle_model || null,
    plate_number: args.plate_number,
  };
  // flat_id is text — no numeric conversion
  if (args.flat_id) payload.flat_id = String(args.flat_id);
  if (args.slot_number) payload.slot_number = args.slot_number;

  const { error } = await supabase.from("parking").update(payload).eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function deleteParkingSlot(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("parking").delete().eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function fetchMaintenanceAssets(): Promise<MaintenanceAssetRow[]> {
  const { data, error } = await supabase.from("maintenance_assets").select("*").order("id");
  return error ? [] : (data as MaintenanceAssetRow[]) ?? [];
}

export async function checkoutVisitor(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("visitors").update({ exit_time: new Date().toISOString() }).eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function insertVisitor(args: {
  name: string;
  phone: string;
  flat_id: string;
  purpose: string;
  vehicle_number?: string;
  security_id?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("visitors").insert({
    name: args.name,
    phone: args.phone,
    flat_id: args.flat_id,
    purpose: args.purpose,
    vehicle_number: args.vehicle_number ?? null,
    security_id: args.security_id ?? null,
    entry_time: new Date().toISOString(),
  });
  return error ? { error: error.message } : { error: null };
}

export type VisitorDetailed = {
  id: string;
  name: string;
  phone: string;
  flat_id: string;
  flat: string;
  host: string;
  purpose: "Guest" | "Delivery" | "Service" | "Cab";
  checkIn: string;
  checkOut?: string;
  vehicle?: string;
  date: string;
  guard: string;
  entry_time_raw: string;
  exit_time_raw: string | null;
};

export async function fetchVisitorsDetailed(): Promise<VisitorDetailed[]> {
  const { data: visitorsData, error: visitorsErr } = await supabase
    .from("visitors")
    .select(`
      id,
      name,
      phone,
      vehicle_number,
      purpose,
      entry_time,
      exit_time,
      security_id,
      flat_id,
      flats:flat_id (
        id,
        flat_number,
        owner_name,
        blocks:block_id (
          name
        ),
        residents (
          name
        )
      )
    `)
    .order("entry_time", { ascending: false });

  if (visitorsErr) {
    console.error("[visitors] SELECT error:", visitorsErr.message);
    return [];
  }

  const { data: profilesData, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, full_name");

  const guardMap = new Map<string, string>();
  if (!profilesErr && profilesData) {
    profilesData.forEach((p) => {
      guardMap.set(p.id, p.full_name || "System");
    });
  }

  const list = (visitorsData ?? []) as any[];

  return list.map((v) => {
    const blockName = v.flats?.blocks?.name ?? "";
    const flatNum = v.flats?.flat_number ?? "";
    const flatLabel = blockName && flatNum ? `${blockName}-${flatNum}` : "N/A";
    
    const residentName = v.flats?.residents?.[0]?.name ?? v.flats?.owner_name ?? "Host";
    const guardName = v.security_id ? (guardMap.get(v.security_id) ?? "Security Guard") : "Security Guard";

    const checkInTime = v.entry_time
      ? new Date(v.entry_time).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "";

    const checkOutTime = v.exit_time
      ? new Date(v.exit_time).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : undefined;

    const entryDate = v.entry_time
      ? new Date(v.entry_time).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

    return {
      id: v.id,
      name: v.name,
      phone: v.phone || "—",
      flat_id: v.flat_id || "",
      flat: flatLabel,
      host: residentName,
      purpose: v.purpose as any,
      checkIn: checkInTime,
      checkOut: checkOutTime,
      vehicle: v.vehicle_number || undefined,
      date: entryDate,
      guard: guardName,
      entry_time_raw: v.entry_time,
      exit_time_raw: v.exit_time,
    };
  });
}

export async function fetchActiveVisitorsDetailed(): Promise<VisitorDetailed[]> {
  const all = await fetchVisitorsDetailed();
  return all.filter((v) => !v.exit_time_raw);
}

export type MaintenanceRow = {
  id: number;
  asset_name: string;
  location: string;
  last_service_date: string | null;
  next_due_date: string | null;
  cost: number;
  vendor_name: string;
  vendor_contact: string;
  status: string;
};

export async function fetchMaintenanceAll(): Promise<MaintenanceRow[]> {
  const { data, error } = await supabase
    .from("maintenance")
    .select("*")
    .order("next_due_date", { ascending: true });
  return error ? [] : (data as MaintenanceRow[]) ?? [];
}

export async function insertMaintenanceEntry(args: {
  asset_name: string;
  location: string;
  last_service_date: string | null;
  next_due_date: string | null;
  cost: number;
  vendor_name: string;
  vendor_contact: string;
  status: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("maintenance").insert(args);
  return error ? { error: error.message } : { error: null };
}

export async function updateMaintenanceEntry(
  id: number,
  args: {
    asset_name?: string;
    location?: string;
    last_service_date?: string | null;
    next_due_date?: string | null;
    cost?: number;
    vendor_name?: string;
    vendor_contact?: string;
    status?: string;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("maintenance").update(args).eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function deleteMaintenanceEntry(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from("maintenance").delete().eq("id", id);
  return error ? { error: error.message } : { error: null };
}

