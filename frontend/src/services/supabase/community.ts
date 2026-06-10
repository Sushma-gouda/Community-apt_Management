import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase/client";

const supabaseAdminClient = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string,
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
  content: string;
  category: string;
  priority: string;
  target_audience: string;
  target_block: string | null;
  publish_date: string;
  expiry_date: string | null;
  scheduled_at: string | null;
  created_by: string | null;
  created_at: string;
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
  const { count, error } = await supabase.from("visitors").select("*", { count: "exact", head: true }).eq("status", "checked_in");
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
  const { data: bill, error } = await supabase.from("bills").insert({
    resident_id: args.resident_id,
    amount:  args.amount,
    due_date: args.due_date,
    status:  "pending",
    label:   args.label ?? "Maintenance",
  }).select('id').single();
  
  if (!error && bill) {
    const { data: r } = await supabase.from("residents").select("user_id").eq("id", args.resident_id).single();
    if (r && r.user_id) {
       await createNotification({
         user_id: r.user_id,
         title: 'New Bill Generated',
         message: `A new bill for ${args.label || 'Maintenance'} (₹${args.amount}) has been generated.`,
         type: 'bill_created',
         related_module: 'billing',
         related_record_id: bill.id,
         created_by: 'Admin',
       });
    }
  }
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
  const { error: insErr } = await supabase.from("bills").insert(rows);

  if (!insErr) {
     const residentIds = residents.map(r => r.id);
     const { data: usersData } = await supabase.from('residents').select('id, user_id').in('id', residentIds);
     
     if (usersData) {
       for (const u of usersData) {
         if (u.user_id) {
           await createNotification({
             user_id: u.user_id,
             title: 'New Bill Generated',
             message: `A new bill for ${args.label || 'Maintenance'} (₹${args.amount}) has been generated.`,
             type: 'bill_created',
             related_module: 'billing',
             created_by: 'Admin',
           });
         }
       }
     }
  }

  return { count: rows.length, error: insErr ? insErr.message : null };
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
  
  // Notify admin that bill is paid
  const bill = data[0];
  await createNotification({
    user_role: 'admin',
    title: 'Bill Paid',
    message: `Bill #${bill.id} has been paid.`,
    type: 'bill_paid',
    related_module: 'billing',
    related_record_id: bill.id.toString(),
    created_by: 'Resident',
  });
  
  return { error: null };
}

export async function fetchRecentVisitors(limit: number): Promise<VisitorDetailed[]> {
  const all = await fetchVisitorsDetailed();
  return all.slice(0, limit);
}
export async function fetchVisitorsAll(): Promise<VisitorDetailed[]> {
  return fetchVisitorsDetailed();
}

// ==== NOTICES ====

function mapDBNotice(row: any): NoticeRow {
  return {
    id: row.id,
    title: row.title,
    content: row.body || "",
    category: row.tag || "General",
    priority: row.pinned ? "Important" : "Normal",
    target_audience: row.target_block === "all" ? "All Residents" : "Specific Block",
    target_block: row.target_block === "all" ? null : row.target_block,
    publish_date: row.published_at,
    expiry_date: null,
    scheduled_at: row.scheduled_at || null,
    created_by: "Admin",
    created_at: row.published_at
  };
}

function mapNoticeToDB(args: any) {
  const db: any = {};
  if (args.title !== undefined) db.title = args.title;
  if (args.content !== undefined) db.body = args.content;
  if (args.category !== undefined) db.tag = args.category;
  if (args.priority !== undefined) db.pinned = args.priority === "Urgent" || args.priority === "Important";
  if (args.target_audience !== undefined || args.target_block !== undefined) {
    db.target_block = args.target_audience === "All Residents" ? "all" : (args.target_block || "all");
  }
  if (args.publish_date !== undefined) db.published_at = args.publish_date;
  if (args.scheduled_at !== undefined) db.scheduled_at = args.scheduled_at;
  return db;
}

export async function fetchAdminNotices(): Promise<NoticeRow[]> {
  const { data, error } = await supabase.from("notices").select("*").order("published_at", { ascending: false });
  return error ? [] : (data || []).map(mapDBNotice);
}

export async function fetchResidentNotices(limit?: number): Promise<NoticeRow[]> {
  let query = supabase.from("notices").select("*").order("published_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  return error ? [] : (data || []).map(mapDBNotice);
}

export async function createNotice(args: Omit<NoticeRow, "id" | "created_at" | "created_by">): Promise<{ error: string | null }> {
  const dbPayload = mapNoticeToDB(args);
  dbPayload.id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
  
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out. Please check your connection.")), 8000));
    const res: any = await Promise.race([
      supabase.from("notices").insert([dbPayload]),
      timeout
    ]);
    return res.error ? { error: res.error.message } : { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateNotice(id: string, args: Partial<NoticeRow>): Promise<{ error: string | null }> {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out. Please check your connection.")), 8000));
    const res: any = await Promise.race([
      supabase.from("notices").update(mapNoticeToDB(args)).eq("id", id),
      timeout
    ]);
    return res.error ? { error: res.error.message } : { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteNotice(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("notices").delete().eq("id", id);
  return error ? { error: error.message } : { error: null };
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
  const { data: comp, error } = await supabase.from("complaints").insert({
    resident_id: args.resident_id,
    title: args.title,
    description: args.body,
    flat_label: args.flat_label,
    status: "open",
    category: args.category || "General",
    priority: (args.priority || "medium").toLowerCase(),
  }).select('id').single();
  
  if (!error && comp) {
    await createNotification({
      user_role: 'admin',
      title: 'New Complaint Raised',
      message: `A new complaint "${args.title}" has been raised.`,
      type: 'complaint_created',
      related_module: 'complaints',
      related_record_id: comp.id,
      created_by: 'Resident',
    });
  }
  
  return error ? { error: error.message } : { error: null };
}

export async function updateComplaintStatus(id: string, status: string): Promise<{ error: string | null }> {
  const dbStatus = status === "pending" ? "open" : status === "in-progress" ? "in_progress" : status;
  const { error } = await supabase.from("complaints").update({ status: dbStatus, updated_at: new Date().toISOString() }).eq("id", id);
  
  if (!error) {
    const { data: c } = await supabase.from("complaints").select("resident_id, title").eq("id", id).single();
    if (c) {
      const { data: r } = await supabase.from("residents").select("user_id").eq("id", c.resident_id).single();
      if (r && r.user_id) {
         await createNotification({
           user_id: r.user_id,
           title: 'Complaint Status Updated',
           message: `Your complaint "${c.title}" is now ${status}.`,
           type: 'complaint_updated',
           related_module: 'complaints',
           related_record_id: id,
           created_by: 'Admin',
         });
      }
    }
  }
  
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
    .select(`id, name, full_name, email, phone, alt_phone, bio, flat_id, family_count, status, user_id, created_at,
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
  alt_phone?: string;
  bio?: string;
}): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Update residents table directly
  const { error: resError } = await supabase
    .from("residents")
    .update({
      name: args.name,
      full_name: args.name, // Ensure full_name is also updated
      phone: args.phone,
      family_count: args.family_count,
      alt_phone: args.alt_phone,
      bio: args.bio,
    })
    .eq("user_id", user.id);

  if (resError) return { error: resError.message };

  // Sync with profiles table
  if (args.name) {
    const { error: profError } = await supabase
      .from("profiles")
      .update({
        full_name: args.name,
        phone: args.phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
      
    if (profError) {
      console.warn("Failed to sync profile:", profError.message);
    }
  }

  return { error: null };
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
  purpose: string;
  vehicle?: string;
  status: string;
  otp?: string | null;
  otp_expires_at?: string | null;
  checkIn: string;
  checkOut?: string;
  date: string;
  entry_time_raw: string;
  exit_time_raw: string | null;
  visitor_count: number;
  flat: string;
  host: string;
  guard: string;
  resident_id?: string;
};

export async function fetchVisitorsDetailed(): Promise<VisitorDetailed[]> {
  const { data, error } = await supabase.from('visitors').select('*').order('check_in', { ascending: false });
  if (error || !data) return [];
  
  return data.map((v: any) => {
    let checkInTime = '';
    if (v.check_in) {
      const dt = new Date(v.check_in);
      checkInTime = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    let checkOutTime: string | undefined;
    if (v.check_out) {
      const dt = new Date(v.check_out);
      checkOutTime = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    const entryDate = v.check_in
      ? new Date(v.check_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Pending';
      
    return {
      id: v.id,
      name: v.name,
      phone: v.phone || '?',
      purpose: v.purpose,
      vehicle: v.vehicle,
      status: v.status,
      otp: v.otp,
      otp_expires_at: v.otp_expires_at,
      checkIn: checkInTime,
      checkOut: checkOutTime,
      date: entryDate,
      entry_time_raw: v.check_in,
      exit_time_raw: v.check_out,
      visitor_count: v.visitor_count || 1,
      flat: (v.block_id || '') + '-' + (v.flat_number || ''),
      host: v.host_name || '?',
      guard: 'Gate 1',
      resident_id: v.resident_id,
    };
  });
}
export async function fetchActiveVisitorsDetailed(): Promise<VisitorDetailed[]> {
  const all = await fetchVisitorsDetailed();
  return all.filter((v) => v.status === 'checked_in');
}

export type MaintenanceRow = {
  id: number;
  asset_name: string;
  category: string;
  description: string;
  location: string;
  scheduled_date: string | null;
  completion_date: string | null;
  cost: number;
  vendor_name: string;
  vendor_contact: string;
  priority: string;
  status: string;
};

export async function fetchMaintenanceAll(): Promise<MaintenanceRow[]> {
  const { data, error } = await supabase
    .from("maintenance")
    .select("*")
    .order("scheduled_date", { ascending: true });
  return error ? [] : (data as MaintenanceRow[]) ?? [];
}

export async function insertMaintenanceEntry(args: {
  asset_name: string;
  category: string;
  description: string;
  location: string;
  scheduled_date: string | null;
  completion_date: string | null;
  cost: number;
  vendor_name: string;
  vendor_contact: string;
  priority: string;
  status: string;
}): Promise<{ error: string | null }> {
  const payload: any = { ...args };
  const { data: maint, error } = await supabase.from("maintenance").insert(payload).select('id').single();
  
  if (!error && maint) {
    await createNotification({
      user_role: 'security',
      title: 'Maintenance Scheduled',
      message: `Maintenance for ${args.asset_name} scheduled at ${args.location}.`,
      type: 'maintenance_scheduled',
      related_module: 'maintenance',
      related_record_id: maint.id.toString(),
      created_by: 'Admin',
    });
  }
  
  return error ? { error: error.message } : { error: null };
}

export async function updateMaintenanceEntry(
  id: number,
  args: {
    asset_name?: string;
    category?: string;
    description?: string;
    location?: string;
    scheduled_date?: string | null;
    completion_date?: string | null;
    cost?: number;
    vendor_name?: string;
    vendor_contact?: string;
    priority?: string;
    status?: string;
  }
): Promise<{ error: string | null }> {
  const payload: any = { ...args };
  const { error } = await supabase.from("maintenance").update(payload).eq("id", id);
  return error ? { error: error.message } : { error: null };
}

export async function deleteMaintenanceEntry(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from("maintenance").delete().eq("id", id);
  return error ? { error: error.message } : { error: null };

}
export type NotificationRow = {
  id: string;
  user_id?: string | null;
  user_role?: string | null;
  type: string;
  title: string;
  message: string;
  related_module?: string | null;
  related_record_id?: string | null;
  read: boolean;
  created_at: string;
  created_by?: string | null;
};

export async function fetchNotifications(role?: string, userId?: string): Promise<NotificationRow[]> {
  if (!role && !userId) return [];
  
  let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  
  if (role && userId) {
    query = query.or(`user_id.eq.${userId},user_role.eq.${role.toLowerCase()}`);
  } else if (userId) {
    query = query.eq('user_id', userId);
  } else if (role) {
    query = query.eq('user_role', role.toLowerCase());
  }

  const { data, error } = await query;
  return error ? [] : (data as NotificationRow[]);
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  return error ? { error: error.message } : { error: null };
}

export async function markAllNotificationsRead(role?: string, userId?: string): Promise<{ error: string | null }> {
  if (!role && !userId) return { error: 'No user identified' };
  
  let query = supabase.from('notifications').update({ read: true }).eq('read', false);
  
  if (role && userId) {
    query = query.or(`user_id.eq.${userId},user_role.eq.${role.toLowerCase()}`);
  } else if (userId) {
    query = query.eq('user_id', userId);
  } else if (role) {
    query = query.eq('user_role', role.toLowerCase());
  }
  
  const { error } = await query;
  return error ? { error: error.message } : { error: null };
}

export async function createNotification(args: {
  user_id?: string | null;
  user_role?: string | null;
  type: string;
  title: string;
  message: string;
  related_module?: string;
  related_record_id?: string;
  created_by?: string;
}): Promise<{ error: string | null }> {
  // Deduplication: prevent duplicate notifications for the same record/type within 10 minutes
  if (args.related_record_id && args.type) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let dupQuery = supabase
      .from('notifications')
      .select('id')
      .eq('type', args.type)
      .eq('related_record_id', args.related_record_id)
      .gte('created_at', tenMinutesAgo);

    if (args.user_role) dupQuery = dupQuery.eq('user_role', args.user_role.toLowerCase());
    if (args.user_id) dupQuery = dupQuery.eq('user_id', args.user_id);

    const { data: existing } = await dupQuery.limit(1);
    if (existing && existing.length > 0) {
      // Already sent this notification recently — skip
      return { error: null };
    }
  }

  const payload: any = { ...args };
  if (payload.user_role) payload.user_role = payload.user_role.toLowerCase();
  
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) {
    console.error("Notification insert error:", error);
  }
  return error ? { error: error.message } : { error: null };
}

export async function createVisitorRequest(args: {
  name: string;
  phone: string;
  purpose: string;
  visitor_count: number;
  vehicle?: string;
  block_id?: string;
  resident_id: string;
  flat_number: string;
  host_name: string;
}): Promise<{ error: string | null }> {
  // Insert visitor as pending
  const { data: visitor, error } = await supabase.from('visitors').insert({
    name: args.name,
    phone: args.phone,
    purpose: args.purpose,
    visitor_count: args.visitor_count,
    vehicle: args.vehicle || null,
    block_id: args.block_id || null,
    resident_id: args.resident_id,
    flat_number: args.flat_number,
    host_name: args.host_name,
    status: 'pending',
  }).select('id').single();

  if (error || !visitor) return { error: error?.message || 'Failed to create request' };

  // Notify resident
  const { data: resident } = await supabase.from('residents').select('user_id').eq('id', args.resident_id).single();
  
  if (resident && resident.user_id) {
    const { error: notifErr } = await createNotification({
      user_id: resident.user_id,
      title: 'New Visitor Request',
      message: `${args.name} is waiting at the gate for ${args.purpose}.`,
      type: 'visitor_request',
      related_module: 'visitors',
      related_record_id: visitor.id,
      created_by: 'Security',
    });
    if (notifErr) {
      console.error("Failed to notify resident:", notifErr);
      return { error: "Visitor added, but failed to send notification: " + notifErr };
    }
  }

  return { error: null };
}

export async function approveVisitorRequest(id: string, residentUserId: string): Promise<{ otp: string | null, error: string | null }> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const { error } = await supabase.from('visitors').update({
    status: 'approved',
    otp: otp,
    otp_expires_at: expiresAt,
  }).eq('id', id);

  if (error) return { otp: null, error: error.message };

  await createNotification({
    user_role: 'security',
    title: 'Visitor Approved',
    message: `A visitor request has been approved.`,
    type: 'visitor_approved',
    related_module: 'visitors',
    related_record_id: id,
    created_by: 'Resident',
  });

  return { otp, error: null };
}

export async function rejectVisitorRequest(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('visitors').update({
    status: 'rejected',
  }).eq('id', id);

  if (!error) {
    await createNotification({
      user_role: 'security',
      title: 'Visitor Rejected',
      message: `A visitor request has been rejected.`,
      type: 'visitor_rejected',
      related_module: 'visitors',
      related_record_id: id,
      created_by: 'Resident',
    });
  }

  return error ? { error: error.message } : { error: null };
}

export async function verifyVisitorOtpAndCheckIn(id: string, otp: string, parkingSlotId?: string): Promise<{ error: string | null }> {
  // First, verify OTP
  const { data, error: fetchErr } = await supabase.from('visitors').select('otp, otp_expires_at, status').eq('id', id).single();
  if (fetchErr || !data) return { error: fetchErr?.message || 'Visitor not found' };

  if (data.status !== 'approved') return { error: 'Visitor request is not approved' };
  if (data.otp !== otp) return { error: 'Invalid OTP' };
  
  const now = new Date();
  if (data.otp_expires_at && new Date(data.otp_expires_at) < now) {
    return { error: 'OTP has expired' };
  }

  // OTP verified, check in
  const updateData: any = {
    status: 'checked_in',
    check_in: now.toISOString(),
  };

  if (parkingSlotId) {
    // Find the actual parking slot ID since they might have typed the slot_number (e.g., "P-001")
    const { data: slot } = await supabase
      .from('parking_slots')
      .select('id')
      .or(`id.eq.${parkingSlotId},slot_number.eq.${parkingSlotId}`)
      .maybeSingle();
      
    if (!slot) {
      return { error: `Parking slot '${parkingSlotId}' not found.` };
    }
    
    updateData.parking_slot_id = slot.id;
    // Update parking slot status
    await supabase.from('parking_slots').update({ status: 'occupied' }).eq('id', slot.id);
  }

  const { error: updateErr } = await supabase.from('visitors').update(updateData).eq('id', id);
  
  if (!updateErr) {
    const { data: v } = await supabase.from('visitors').select('resident_id, name').eq('id', id).single();
    if (v) {
      const { data: r } = await supabase.from('residents').select('user_id').eq('id', v.resident_id).single();
      if (r && r.user_id) {
        await createNotification({
          user_id: r.user_id,
          title: 'Visitor Checked In',
          message: `${v.name} has checked in.`,
          type: 'visitor_checked_in',
          related_module: 'visitors',
          related_record_id: id,
          created_by: 'Security',
        });
      }
    }
  }

  return updateErr ? { error: updateErr.message } : { error: null };
}

export async function checkoutVisitor(id: string): Promise<{ error: string | null }> {
  // Get visitor to see if they had a parking slot
  const { data } = await supabase.from('visitors').select('parking_slot_id').eq('id', id).single();

  const { error } = await supabase.from('visitors').update({ 
    status: 'checked_out', 
    check_out: new Date().toISOString() 
  }).eq('id', id);

  if (!error) {
    if (data?.parking_slot_id) {
      // Release parking slot
      await supabase.from('parking_slots').update({ status: 'free' }).eq('id', data.parking_slot_id);
    }
    
    const { data: v } = await supabase.from('visitors').select('resident_id, name').eq('id', id).single();
    if (v) {
      const { data: r } = await supabase.from('residents').select('user_id').eq('id', v.resident_id).single();
      if (r && r.user_id) {
        await createNotification({
          user_id: r.user_id,
          title: 'Visitor Checked Out',
          message: `${v.name} has checked out.`,
          type: 'visitor_checked_out',
          related_module: 'visitors',
          related_record_id: id,
          created_by: 'Security',
        });
      }
    }
  }

  return error ? { error: error.message } : { error: null };
}


// --- Admin Dashboard Aggregation Functions ---

export async function fetchMaintenanceCollectionsChart(): Promise<number[]> {
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1).toISOString();
  
  const { data, error } = await supabase
    .from('bills')
    .select('amount, created_at')
    .eq('status', 'paid')
    .gte('created_at', startOfYear);
    
  if (error || !data) return Array(12).fill(0);
  
  const monthlyTotals = Array(12).fill(0);
  data.forEach(bill => {
    const d = new Date(bill.created_at);
    if (d.getFullYear() === currentYear) {
      monthlyTotals[d.getMonth()] += Number(bill.amount) || 0;
    }
  });
  
  // Return the totals array directly
  return monthlyTotals;
}

export async function fetchQuickStats(): Promise<{
  billsPaidPercent: number;
  complaintSlaPercent: number;
  visitorApprovalsPercent: number;
  maintenanceCompletedPercent: number;
}> {
  let billsPaidPercent = 0, complaintSlaPercent = 0, visitorApprovalsPercent = 0, maintenanceCompletedPercent = 0;
  
  const [bills, complaints, visitors, maintenance] = await Promise.all([
    supabase.from('bills').select('status', { count: 'exact' }),
    supabase.from('complaints').select('status', { count: 'exact' }),
    supabase.from('visitors').select('status', { count: 'exact' }),
    supabase.from('maintenance_tasks').select('status', { count: 'exact' }),
  ]);

  if (bills.data && bills.data.length > 0) {
    const paid = bills.data.filter(b => b.status === 'paid').length;
    billsPaidPercent = Math.round((paid / bills.data.length) * 100);
  }

  if (complaints.data && complaints.data.length > 0) {
    const resolved = complaints.data.filter(c => c.status === 'resolved').length;
    complaintSlaPercent = Math.round((resolved / complaints.data.length) * 100);
  }

  if (visitors.data && visitors.data.length > 0) {
    const approved = visitors.data.filter(v => v.status === 'approved' || v.status === 'checked-in' || v.status === 'checked-out').length;
    visitorApprovalsPercent = Math.round((approved / visitors.data.length) * 100);
  }

  if (maintenance.data && maintenance.data.length > 0) {
    const completed = maintenance.data.filter(m => m.status === 'completed').length;
    maintenanceCompletedPercent = Math.round((completed / maintenance.data.length) * 100);
  }

  return {
    billsPaidPercent,
    complaintSlaPercent,
    visitorApprovalsPercent,
    maintenanceCompletedPercent
  };
}

export async function fetchActivityTimeline(limit = 10): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error || !data) return [];
  return data as NotificationRow[];
}

export async function fetchPublicLandingStats() {
  const { data, error } = await supabase.rpc("get_public_landing_stats");
  if (error) {
    console.error("fetchPublicLandingStats error:", error);
    return null;
  }
  return data;
}
