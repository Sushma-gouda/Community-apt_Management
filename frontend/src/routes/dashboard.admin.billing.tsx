import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Plus, Download, FileText, Loader2 } from "lucide-react";
import { Badge, Card, DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { adminNav } from "@/components/dashboard/adminNav";
import {
  Field,
  FilterPill,
  GhostButton,
  Modal,
  PageHeader,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "@/components/dashboard/PageHeader";
import {
  fetchBillsAllDetailed,
  createBillsBulk,
  fetchBlocks,
  type BillDetailed,
} from "@/services/supabase/community";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/dashboard/admin/billing")({
  head: () => ({ meta: [{ title: "Billing — Communa Admin" }] }),
  component: BillingPage,
});

type BillStatus = "Paid" | "Pending" | "Overdue";

type Bill = {
  id: string;
  flat: string;
  block: string;
  resident: string;
  amount: number;
  due: string;
  dueRaw: string | null;
  paidAt: string | null;
  status: BillStatus;
  label: string;
  raw_id: number | string;
};

const statusMap: Record<string, BillStatus> = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
};

const BILL_LABELS = [
  "Maintenance",
  "Water Charges",
  "Electricity Charges",
  "Parking Fee",
  "Security Charges",
  "Clubhouse Fee",
  "Other",
];

function BillingPage() {
  const [data, setData] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);       // initial load only
  const [refreshing, setRefreshing] = useState(false); // silent background refresh
  const [blocks, setBlocks] = useState<any[]>([]);
  const [status, setStatus] = useState<"All" | BillStatus>("All");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    labelPreset: "Maintenance",
    labelCustom: "",
    target: "all",
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split("T")[0],
    amount: 4500,
  });

  const effectiveLabel =
    form.labelPreset === "Other" ? form.labelCustom.trim() || "Other" : form.labelPreset;

  async function loadData(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [detailed, blockRows] = await Promise.all([
        fetchBillsAllDetailed(),
        fetchBlocks(),
      ]);

      setBlocks(blockRows);

      const mapped: Bill[] = detailed.map((b: BillDetailed) => ({
        id: `INV-${String(b.id).slice(0, 6).toUpperCase()}`,
        raw_id: b.id,
        flat: b.flat_number,
        block: b.block_name,
        resident: b.resident_name,
        amount: Number(b.amount),
        due: b.due_date
          ? new Date(b.due_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "N/A",
        dueRaw: b.due_date,
        paidAt: b.paid_at,
        // DB status is exactly 'pending'|'paid'|'overdue' — map to UI casing
        status: statusMap[b.status] ?? "Pending",
        label: b.label ?? "Maintenance",
      }));

      setData(mapped);
    } catch (err) {
      console.error("Error loading billing data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async () => {
    setGenerateError(null);
    setSuccessMsg(null);
    if (!form.dueDate) { setGenerateError("Please select a due date."); return; }
    if (form.amount <= 0) { setGenerateError("Amount must be greater than 0."); return; }
    if (form.labelPreset === "Other" && !form.labelCustom.trim()) {
      setGenerateError("Please enter a custom bill description.");
      return;
    }

    setSubmitting(true);
    try {
      const { count, error } = await createBillsBulk({
        target: form.target,
        amount: form.amount,
        due_date: form.dueDate,
        label: effectiveLabel,
      });

      if (error) {
        setGenerateError(error);
      } else {
        setOpen(false);
        setGenerateError(null);
        setSuccessMsg(`✅ Generated ${count} bill(s) for "${effectiveLabel}" — ₹${Number(form.amount).toLocaleString()} per flat.`);
        // Silently refresh the table in background
        loadData(true);
      }
    } catch (err: any) {
      console.error("Error generating bills:", err);
      setGenerateError(err?.message ?? "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Premium PDF Export ──────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = status === "All" ? data : data.filter((b) => b.status === status);
    if (rows.length === 0) { alert("No billing data to export."); return; }

    const doc = new jsPDF();
    const now = new Date();

    // Primary Header block
    doc.setFillColor(30, 41, 59); // Slate-800 Theme for Admin Report
    doc.rect(0, 0, 210, 40, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("COMMUNA HEIGHTS", 15, 22);

    // Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Master Billing & Accounts Statement — Administrative Portal", 15, 31);

    // Metadata header
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("REPORT METADATA & PARAMETERS", 15, 55);

    // Columns of meta information
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated By:  Society Administration`, 15, 63);
    doc.text(`Target Scope:  All Registered Units`, 15, 69);
    doc.text(`Active Filter:  ${status}`, 15, 75);

    // Stats calculations
    const totalAmount = rows.reduce((s, b) => s + b.amount, 0);
    const paidAmount = rows.filter((b) => b.status === "Paid").reduce((s, b) => s + b.amount, 0);
    const pendingAmount = rows.filter((b) => b.status === "Pending" || b.status === "Overdue").reduce((s, b) => s + b.amount, 0);

    doc.text(`Report Date:   ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, 110, 63);
    doc.text(`Total Records:  ${rows.length} bill(s)`, 110, 69);
    doc.text(`Total Value:    INR ${totalAmount.toLocaleString()}`, 110, 75);

    // Divider Line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(15, 80, 195, 80);

    // Key Performance Indicators section in PDF
    doc.setFillColor(248, 250, 252); // slate-50 background for stats panel
    doc.rect(15, 85, 180, 18, "F");
    doc.setDrawColor(203, 213, 225); // slate-300 border
    doc.rect(15, 85, 180, 18, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text("SUMMARY METRICS FOR EXPORTED DATA", 20, 91);

    doc.setFont("helvetica", "normal");
    doc.text(`Total Volume: INR ${totalAmount.toLocaleString()}`, 20, 98);
    doc.text(`Total Paid: INR ${paidAmount.toLocaleString()}`, 80, 98);
    doc.text(`Unpaid / Outstanding: INR ${pendingAmount.toLocaleString()}`, 135, 98);

    // Table Setup
    const tableHeaders = [
      "Invoice ID",
      "Flat",
      "Block",
      "Resident",
      "Bill Label",
      "Amount",
      "Status",
      "Due Date",
      "Paid On",
    ];

    const tableRows = rows.map((b) => [
      b.id,
      b.flat,
      b.block,
      b.resident ?? "—",
      b.label,
      `INR ${b.amount.toLocaleString()}`,
      b.status,
      b.dueRaw ?? b.due,
      b.paidAt ? new Date(b.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
    ]);

    autoTable(doc, {
      startY: 110,
      head: [tableHeaders],
      body: tableRows,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59], // Slate-800 Header
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3.5,
      },
      columnStyles: {
        5: { halign: "right" }, // Align amount right
      },
      didParseCell: (cellData) => {
        if (cellData.column.index === 6 && cellData.cell.section === "body") {
          const statusVal = cellData.cell.text[0];
          if (statusVal === "Paid") {
            cellData.cell.styles.textColor = [22, 163, 74]; // green-600
            cellData.cell.styles.fontStyle = "bold";
          } else if (statusVal === "Overdue") {
            cellData.cell.styles.textColor = [220, 38, 38]; // red-600
            cellData.cell.styles.fontStyle = "bold";
          } else if (statusVal === "Pending") {
            cellData.cell.styles.textColor = [217, 119, 6]; // amber-600
            cellData.cell.styles.fontStyle = "bold";
          }
        }
      }
    });

    const monthName = now.toLocaleString("en-US", { month: "long" }).toLowerCase();
    const year = now.getFullYear();
    const suffix = status === "All" ? "all" : status.toLowerCase();
    doc.save(`billing-report-${suffix}-${monthName}-${year}.pdf`);
  };

  const filtered = useMemo(
    () => data.filter((b) => status === "All" || b.status === status),
    [data, status],
  );

  const tone = (s: BillStatus) =>
    s === "Paid" ? "success" : s === "Pending" ? "warning" : "danger";

  const totals = {
    paid: data.filter((b) => b.status === "Paid").reduce((s, b) => s + b.amount, 0),
    pending: data.filter((b) => b.status === "Pending").reduce((s, b) => s + b.amount, 0),
    overdue: data.filter((b) => b.status === "Overdue").reduce((s, b) => s + b.amount, 0),
  };
  const totalAll = totals.paid + totals.pending + totals.overdue;

  /**
   * Monthly Collection — sum of paid bill amounts grouped by the month
   * bills were generated (using generated_at, since paid_at may be null for
   * bills paid outside the system). Falls back to paid_at when available.
   * Always show all 12 months of the current year.
   */
  const currentYear = new Date().getFullYear();
  const monthlyAmounts = Array(12).fill(0) as number[];
  data.forEach((b) => {
    if (b.status !== "Paid") return;
    // Use paidAt if available, otherwise fall back to the raw due date on the bill row
    const dateStr = b.paidAt ?? b.dueRaw;
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (d.getFullYear() === currentYear) {
      monthlyAmounts[d.getMonth()] += b.amount;
    }
  });
  // Normalize to % heights (max bar = 100%); if no data at all, keep all 0
  const maxMonthly = Math.max(...monthlyAmounts, 1);
  const monthlyPct = monthlyAmounts.map((v) => Math.round((v / maxMonthly) * 100));

  return (
    <DashboardLayout role="Admin" items={adminNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          title="Billing"
          subtitle="Generate, track, and reconcile maintenance bills."
          actions={
            <>
              <GhostButton onClick={handleExport}>
                <Download className="h-4 w-4" /> Export
                {status !== "All" && (
                  <span className="ml-1 text-[10px] opacity-60">({status})</span>
                )}
              </GhostButton>
              <PrimaryButton onClick={() => { setGenerateError(null); setSuccessMsg(null); setOpen(true); }}>
                <Plus className="h-4 w-4" /> Generate Bill
              </PrimaryButton>
            </>
          }
        />

        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/30 px-4 py-3 text-sm">
            <span className="flex-1 text-[color:var(--success)] font-medium">{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-muted-foreground hover:text-foreground transition text-base leading-none">&times;</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 glass rounded-2xl">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Syncing billing data...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI
                label="Total Billed"
                value={`₹${totalAll.toLocaleString()}`}
                sub={`${data.length} invoice${data.length !== 1 ? "s" : ""}`}
                tone="primary"
              />
              <KPI
                label="Collected"
                value={`₹${totals.paid.toLocaleString()}`}
                sub={totalAll > 0 ? `${Math.round((totals.paid / totalAll) * 100)}% of total` : "0% of total"}
                tone="success"
              />
              <KPI label="Pending" value={`₹${totals.pending.toLocaleString()}`} tone="warning" />
              <KPI label="Overdue" value={`₹${totals.overdue.toLocaleString()}`} tone="danger" />
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <Card title="Paid vs Pending">
                <PaidVsPending paid={totals.paid} pending={totals.pending} overdue={totals.overdue} />
              </Card>
              <div className="lg:col-span-2">
                <Card title={`Monthly Collection ${currentYear}`}>
                  <Bars values={monthlyPct} amounts={monthlyAmounts} />
                </Card>
              </div>
            </div>

            <Card title="Invoices">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {(["All", "Paid", "Pending", "Overdue"] as const).map((s) => (
                  <FilterPill key={s} active={status === s} onClick={() => setStatus(s)}>
                    {s}
                  </FilterPill>
                ))}
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {refreshing && <Loader2 className="h-3 w-3 animate-spin" />}
                  {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-2 py-2 font-medium">Invoice</th>
                      <th className="px-2 py-2 font-medium">Flat</th>
                      <th className="px-2 py-2 font-medium">Resident</th>
                      <th className="px-2 py-2 font-medium">Label</th>
                      <th className="px-2 py-2 font-medium">Amount</th>
                      <th className="px-2 py-2 font-medium">Due</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr
                        key={b.raw_id}
                        className="border-b border-border last:border-0 hover:bg-foreground/[0.02] transition-colors"
                      >
                        <td className="px-2 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="grid place-items-center h-7 w-7 rounded-md bg-primary/10 text-primary">
                              <FileText className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-mono text-xs">{b.id}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <div className="font-medium">{b.flat}</div>
                          <div className="text-[11px] text-muted-foreground">{b.block}</div>
                        </td>
                        <td className="px-2 py-3 text-foreground/80">{b.resident}</td>
                        <td className="px-2 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/[0.06] text-foreground/70 font-medium">
                            {b.label}
                          </span>
                        </td>
                        <td className="px-2 py-3 font-semibold">₹{b.amount.toLocaleString()}</td>
                        <td className="px-2 py-3">
                          <DueIndicator due={b.due} status={b.status} />
                        </td>
                        <td className="px-2 py-3">
                          <Badge tone={tone(b.status)}>{b.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-14 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-8 w-8 opacity-30" />
                            <span>No invoices found.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Generate Bill"
        footer={
          <>
            <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={handleGenerate} disabled={submitting}>
              {submitting ? "Generating..." : "Generate"}
            </PrimaryButton>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {/* Bill Label Dropdown */}
          <div className="col-span-2">
            <Field label="Bill Description">
              <SelectInput
                value={form.labelPreset}
                onChange={(e) => setForm({ ...form, labelPreset: e.target.value, labelCustom: "" })}
              >
                {BILL_LABELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </SelectInput>
            </Field>
          </div>

          {/* Custom label input shown only when "Other" is selected */}
          {form.labelPreset === "Other" && (
            <div className="col-span-2">
              <Field label="Custom Description">
                <TextInput
                  placeholder="e.g. Annual Sinking Fund"
                  value={form.labelCustom}
                  onChange={(e) => setForm({ ...form, labelCustom: e.target.value })}
                />
              </Field>
            </div>
          )}

          <Field label="Target">
            <SelectInput value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
              <option value="all">All Occupied Flats</option>
              {blocks.map((bl) => (
                // bl.name is already "A Block", "B Block", etc. — no prefix needed
                <option key={bl.id} value={bl.id}>{bl.name}</option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Due Date">
            <TextInput
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Amount per Flat (₹)">
              <TextInput
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </Field>
          </div>

          {/* Preview */}
          <div className="col-span-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Preview: </span>
            <span className="font-semibold text-primary">{effectiveLabel}</span>
            <span className="text-muted-foreground"> · ₹{Number(form.amount).toLocaleString()} per flat</span>
            {form.dueDate && (
              <span className="text-muted-foreground">
                {" "}· Due{" "}
                {new Date(form.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>

          {/* Error */}
          {generateError && (
            <div className="col-span-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              ⚠ {generateError}
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  const map: Record<string, string> = {
    primary: "from-primary/20 to-primary/5",
    success: "from-[color:var(--success)]/25 to-[color:var(--success)]/5",
    warning: "from-[color:var(--warning)]/25 to-[color:var(--warning)]/5",
    danger: "from-destructive/25 to-destructive/5",
  };
  return (
    <div className={`rounded-2xl glass shadow-card p-5 bg-gradient-to-br ${map[tone]}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function DueIndicator({ due, status }: { due: string; status: BillStatus }) {
  const color =
    status === "Overdue"
      ? "text-destructive"
      : status === "Pending"
        ? "text-[color:var(--warning)]"
        : "text-muted-foreground";
  return <span className={`text-xs font-medium ${color}`}>{due}</span>;
}

function PaidVsPending({ paid, pending, overdue }: { paid: number; pending: number; overdue: number }) {
  const total = paid + pending + overdue || 1;
  const segs = [
    { l: "Paid", v: paid, c: "var(--success)" },
    { l: "Pending", v: pending, c: "var(--warning)" },
    { l: "Overdue", v: overdue, c: "var(--destructive)" },
  ];
  let off = 0;
  const r = 60, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="h-36 w-36 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="oklch(from var(--foreground) l c h / 0.06)" strokeWidth="20" />
        {segs.map((s, i) => {
          const len = (s.v / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={`oklch(from ${s.c} l c h)`}
              strokeWidth="20"
              strokeDasharray={dash}
              strokeDashoffset={-off}
            />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="flex-1 space-y-2">
        {segs.map((s) => (
          <div key={s.l} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `oklch(from ${s.c} l c h)` }} />
              {s.l}
            </span>
            <span className="font-semibold">₹{s.v.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bars({ values, amounts }: { values: number[]; amounts: number[] }) {
  const labels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const currentMonth = new Date().getMonth();
  const hasAnyData = amounts.some((a) => a > 0);

  return (
    <div>
      {!hasAnyData && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No paid bills recorded for {new Date().getFullYear()} yet.
        </p>
      )}
      <div className="grid grid-cols-12 gap-2 h-44 items-end">
        {values.map((v, i) => (
          <div key={i} className="relative group flex flex-col items-center justify-end h-full">
            {/* Tooltip */}
            {amounts[i] > 0 && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex
                whitespace-nowrap bg-foreground text-background text-[10px] font-medium
                px-2 py-1 rounded-md shadow-lg z-10 pointer-events-none">
                ₹{amounts[i].toLocaleString()}
              </div>
            )}
            <div
              className={[
                "w-full rounded-md transition",
                v > 0
                  ? "bg-[image:var(--gradient-primary)] opacity-90 hover:opacity-100"
                  : "bg-foreground/[0.06]",
                i === currentMonth ? "ring-2 ring-primary/50" : "",
              ].join(" ")}
              style={{ height: v > 0 ? `${Math.max(v, 8)}%` : "8%" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-12 gap-2 text-[10px] text-muted-foreground text-center">
        {labels.map((l, i) => (
          <div key={`${l}-${i}`} className={i === currentMonth ? "text-primary font-semibold" : ""}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
