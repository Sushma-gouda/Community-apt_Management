import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  FileText,
  CreditCard,
  X,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  Receipt,
} from "lucide-react";
import { Badge, Card, DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { residentNav } from "@/components/dashboard/residentNav";
import { FilterPill, PageHeader } from "@/components/dashboard/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { fetchBillsForResident, payBill, fetchMyProfile } from "@/services/supabase/community";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/dashboard/resident/billing")({
  head: () => ({ meta: [{ title: "Billing — Communa" }] }),
  component: ResidentBilling,
});

type BillStatus = "Paid" | "Pending" | "Overdue";
type Bill = {
  id: string;
  month: string;
  amount: number;
  due: string;
  dueRaw: string | null;
  status: BillStatus;
  type: string;
  paidOn?: string;
  paidOnRaw?: string | null;
  raw_id: number | string;
};

type ResidentInfo = {
  name: string;
  flat: string;
  block: string;
};

const statusMap: Record<string, BillStatus> = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
};

function ResidentBilling() {
  const { residentHome, initialized } = useAuth();
  const [data, setData] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [filter, setFilter] = useState<"All" | BillStatus>("All");
  const [payModal, setPayModal] = useState<Bill | null>(null);
  const [payStep, setPayStep] = useState<"form" | "success">("form");
  const [resident, setResident] = useState<ResidentInfo>({ name: "—", flat: "—", block: "—" });

  async function loadData() {
    let resId = residentHome?.resident?.id;

    if (!resId && initialized) {
      const profile = await fetchMyProfile();
      if (profile) {
        if (profile.id) resId = profile.id;
        setResident({
          name: profile.name ?? "—",
          flat: profile.flat_number ?? "—",
          block: profile.block_name ?? "—",
        });
      }
    } else if (residentHome) {
      setResident({
        name: residentHome.resident?.name ?? (residentHome as any).resident?.full_name ?? "—",
        flat: residentHome.flat?.flat_number ?? "—",
        block: (residentHome as any).block?.name ?? "—",
      });
    }

    if (!resId) { setLoading(false); return; }

    setLoading(true);
    try {
      const rows = await fetchBillsForResident(resId);
      const mapped: Bill[] = rows.map((r) => ({
        id: `INV-${String(r.id).slice(0, 6).toUpperCase()}`,
        raw_id: r.id,
        month: r.created_at
          ? new Date(r.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : "N/A",
        amount: Number(r.amount),
        due: r.due_date
          ? new Date(r.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "N/A",
        dueRaw: r.due_date ?? null,
        status: statusMap[r.status] ?? "Pending",
        type: r.label ?? "Maintenance",
        paidOn: r.paid_at
          ? new Date(r.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : undefined,
        paidOnRaw: r.paid_at ?? null,
      }));
      setData(mapped);
    } catch (err) {
      console.error("Error loading bills:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialized) loadData();
  }, [initialized, residentHome]);

  const filtered = data.filter((b) => filter === "All" || b.status === filter);
  const tone = (s: BillStatus) =>
    s === "Paid" ? "success" : s === "Pending" ? "warning" : "danger";

  const pendingBills = data.filter((b) => b.status === "Pending" || b.status === "Overdue");
  const totalPaid = data
    .filter(
      (b) =>
        b.status === "Paid" &&
        b.paidOnRaw &&
        new Date(b.paidOnRaw).getFullYear() === new Date().getFullYear()
    )
    .reduce((s, b) => s + b.amount, 0);

  // ── Export all (filtered) bills as a professional PDF ──────────────────────
  const handleExport = () => {
    if (filtered.length === 0) { alert("No records to export."); return; }

    const doc = new jsPDF();
    const now = new Date();

    // Primary Header block
    doc.setFillColor(15, 23, 42); // Slate-900 Theme (Darker than receipt)
    doc.rect(0, 0, 210, 40, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("COMMUNA HEIGHTS", 15, 22);

    // Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 255);
    doc.text("Resident Billing & Payment History Statement", 15, 31);

    // Resident metadata header
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RESIDENT & UNIT INFORMATION", 15, 55);

    // Left Column Info
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Resident Name: ${resident.name}`, 15, 63);
    doc.text(`Flat Number:   ${resident.flat}`, 15, 69);
    doc.text(`Block Name:    ${resident.block}`, 15, 75);

    // Right Column Info
    doc.text(`Statement Date: ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, 125, 63);
    doc.text(`Active Filter:  ${filter}`, 125, 69);
    doc.text(`Total Records:  ${filtered.length}`, 125, 75);

    // Divider Line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(15, 80, 195, 80);

    // Table Setup
    const tableHeaders = ["Invoice ID", "Billing Period", "Bill Type", "Amount", "Due Date", "Paid On", "Status"];
    const tableRows = filtered.map((b) => [
      b.id,
      b.month,
      b.type,
      `INR ${b.amount.toLocaleString()}`,
      b.dueRaw ?? b.due,
      b.paidOnRaw ? new Date(b.paidOnRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : (b.paidOn ?? "—"),
      b.status,
    ]);

    autoTable(doc, {
      startY: 85,
      head: [tableHeaders],
      body: tableRows,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59], // Slate-800 instead of bright purple
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 4,
      },
      columnStyles: {
        3: { halign: "right" }, // Align amount right
      },
      didParseCell: (cellData) => {
        if (cellData.column.index === 6 && cellData.cell.section === "body") {
          const status = cellData.cell.text[0];
          if (status === "Paid") {
            cellData.cell.styles.textColor = [22, 163, 74]; // green-600
            cellData.cell.styles.fontStyle = "bold";
          } else if (status === "Overdue") {
            cellData.cell.styles.textColor = [220, 38, 38]; // red-600
            cellData.cell.styles.fontStyle = "bold";
          } else if (status === "Pending") {
            cellData.cell.styles.textColor = [217, 119, 6]; // amber-600
            cellData.cell.styles.fontStyle = "bold";
          }
        }
      }
    });

    const suffix = filter === "All" ? "all" : filter.toLowerCase();
    const monthStr = now.toLocaleString("en-US", { month: "long" }).toLowerCase();
    const yearStr = now.getFullYear();
    doc.save(`payment-history-${suffix}-${monthStr}-${yearStr}.pdf`);
  };

  // ── Download single bill receipt as a professional PDF ────────────────────
  const downloadReceipt = (b: Bill) => {
    const doc = new jsPDF();
    const now = new Date();

    // Receipt Header block
    doc.setFillColor(30, 41, 59); // Slate-800 Theme
    doc.rect(0, 0, 210, 40, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("COMMUNA HEIGHTS", 15, 22);

    // Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Premium Apartment Living & Society Management", 15, 31);

    // PAYMENT RECEIPT Header Text Right Side
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PAYMENT RECEIPT", 130, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(191, 219, 254); // blue-200
    doc.text(`Receipt No: ${b.id}`, 130, 30);

    // Resident metadata header
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("1. RESIDENT DETAILS", 15, 55);

    // Two-Column details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Resident Name: ${resident.name}`, 15, 63);
    doc.text(`Flat Number:   ${resident.flat}`, 15, 69);
    doc.text(`Block Name:    ${resident.block}`, 15, 75);

    const paidDate = b.paidOnRaw ? new Date(b.paidOnRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : (b.paidOn ?? "—");
    doc.text(`Payment Date:   ${paidDate}`, 115, 63);
    doc.text(`Payment Method: Online / Simulated`, 115, 69);
    doc.text(`Transaction ID: TXN-${String(b.raw_id).replace(/-/g, "").slice(0, 10).toUpperCase()}`, 115, 75);

    // Divider Line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(15, 82, 195, 82);

    // Billing details header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("2. PAYMENT & TRANSACTION DETAILS", 15, 92);

    // Receipt Table
    const tableHeaders = ["Particular Description", "Billing Period", "Due Date", "Payment Status", "Amount Paid"];
    const tableRows = [[
      b.type,
      b.month,
      b.dueRaw ?? b.due,
      "SUCCESSFULLY PAID",
      `INR ${b.amount.toLocaleString()}`,
    ]];

    autoTable(doc, {
      startY: 97,
      head: [tableHeaders],
      body: tableRows,
      theme: "grid",
      headStyles: {
        fillColor: [30, 41, 59], // Slate-800
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 5,
      },
      columnStyles: {
        4: { halign: "right" }, // Amount right aligned
      },
      didParseCell: (cellData) => {
        if (cellData.column.index === 3 && cellData.cell.section === "body") {
          cellData.cell.styles.textColor = [22, 163, 74]; // green-600
          cellData.cell.styles.fontStyle = "bold";
        }
      }
    });

    // Totals Box Position dynamically calculated
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(120, finalY, 75, 20, "F");
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.rect(120, finalY, 75, 20, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text("NET PAID:", 125, finalY + 12);

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(`INR ${b.amount.toLocaleString()}`, 155, finalY + 12);

    // Bottom Slogan / Terms Info
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Thank you for your timely payment! This is an electronically generated receipt; no physical signature is required.", 15, finalY + 40);

    const safeName = b.id.toLowerCase().replace(/\s+/g, "-");
    const period = b.month.toLowerCase().replace(/\s+/g, "-");
    doc.save(`receipt-${safeName}-${period}.pdf`);
  };

  const handlePay = async () => {
    if (!payModal) return;
    setPayLoading(true);
    try {
      const { error } = await payBill({ bill_id: payModal.raw_id as number });
      if (error) {
        alert("Payment failed: " + error);
      } else {
        setPayStep("success");
        loadData();
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <DashboardLayout role="Resident" items={residentNav}>
      <div className="space-y-6 animate-fade-up">
        <PageHeader title="Billing & Payments" subtitle="View and pay your maintenance bills." />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 glass rounded-2xl">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Syncing payment records...</p>
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl glass shadow-card p-5 bg-gradient-to-br from-[color:var(--warning)]/20 to-[color:var(--warning)]/5">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="mt-2 text-2xl font-semibold text-[color:var(--warning)]">
                  ₹{pendingBills.reduce((s, b) => s + b.amount, 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {pendingBills.length} bill(s) due
                </div>
              </div>
              <div className="rounded-2xl glass shadow-card p-5 bg-gradient-to-br from-[color:var(--success)]/20 to-[color:var(--success)]/5">
                <div className="text-xs text-muted-foreground">Total Paid ({new Date().getFullYear()})</div>
                <div className="mt-2 text-2xl font-semibold text-[color:var(--success)]">
                  ₹{totalPaid.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {data.filter((b) => b.status === "Paid").length} bills paid
                </div>
              </div>
              <div className="rounded-2xl glass shadow-card p-5">
                <div className="text-xs text-muted-foreground">Latest Bill Type</div>
                <div className="mt-2 text-2xl font-semibold">{data[0]?.type ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Most recent charge</div>
              </div>
              <div className="rounded-2xl glass shadow-card p-5">
                <div className="text-xs text-muted-foreground">Payment Rate</div>
                <div className="mt-2 text-2xl font-semibold">
                  {data.length > 0
                    ? Math.round((data.filter((b) => b.status === "Paid").length / data.length) * 100)
                    : 100}%
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">On-time payments</div>
              </div>
            </div>

            {/* Pending bills alert strip */}
            {pendingBills.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Pending Bills
                </h2>
                {pendingBills.map((b) => (
                  <div
                    key={b.raw_id}
                    className="rounded-2xl glass shadow-card p-5 border border-[color:var(--warning)]/30 bg-gradient-to-r from-[color:var(--warning)]/5 to-transparent"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="grid place-items-center h-12 w-12 rounded-xl bg-[color:var(--warning)]/15 text-[color:var(--warning)] shrink-0">
                          <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="font-semibold">{b.month} — {b.type}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {b.id} · Due: {b.due}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xl font-semibold">₹{b.amount.toLocaleString()}</div>
                          <Badge tone={b.status === "Overdue" ? "danger" : "warning"}>{b.status}</Badge>
                        </div>
                        <button
                          onClick={() => setPayModal(b)}
                          className="h-10 px-5 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-medium shadow-elegant hover:shadow-glow transition"
                        >
                          Pay Now
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Payment history table */}
            <Card
              title="Payment History"
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExport}
                    title={`Export ${filter === "All" ? "all" : filter} bills as CSV`}
                    className="inline-flex h-8 px-3 items-center gap-1.5 rounded-lg glass text-xs font-medium hover:bg-foreground/5 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export{filter !== "All" && <span className="opacity-60 ml-0.5">({filter})</span>}
                  </button>
                </div>
              }
            >
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {(["All", "Paid", "Pending", "Overdue"] as const).map((s) => (
                  <FilterPill key={s} active={filter === s} onClick={() => setFilter(s)}>
                    {s}
                  </FilterPill>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">
                  {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-2 py-2 font-medium">Invoice</th>
                      <th className="px-2 py-2 font-medium">Month</th>
                      <th className="px-2 py-2 font-medium">Type</th>
                      <th className="px-2 py-2 font-medium">Amount</th>
                      <th className="px-2 py-2 font-medium">Due Date</th>
                      <th className="px-2 py-2 font-medium">Paid On</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium text-right">Action</th>
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
                        <td className="px-2 py-3">{b.month}</td>
                        <td className="px-2 py-3 text-foreground/70">{b.type}</td>
                        <td className="px-2 py-3 font-semibold">₹{b.amount.toLocaleString()}</td>
                        <td className="px-2 py-3 text-foreground/70">{b.due}</td>
                        <td className="px-2 py-3 text-foreground/70">{b.paidOn ?? "—"}</td>
                        <td className="px-2 py-3">
                          <Badge tone={tone(b.status)}>{b.status}</Badge>
                        </td>
                        <td className="px-2 py-3 text-right">
                          {b.status === "Paid" ? (
                            <button
                              onClick={() => downloadReceipt(b)}
                              title="Download receipt as CSV"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                            >
                              <Receipt className="h-3 w-3" />
                              Receipt
                            </button>
                          ) : (
                            <button
                              onClick={() => setPayModal(b)}
                              className="text-xs px-3 py-1.5 rounded-md bg-[image:var(--gradient-primary)] text-white font-medium hover:shadow-glow transition"
                            >
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-muted-foreground">
                          No billing records found.
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

      {/* Pay modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setPayModal(null); setPayStep("form"); }}
          />
          <div className="relative w-full max-w-md rounded-2xl glass-strong shadow-elegant p-6 animate-scale-in">
            {payStep === "success" ? (
              <div className="text-center py-6">
                <div className="mx-auto grid place-items-center h-16 w-16 rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)] mb-4">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="text-xl font-semibold">Payment Successful!</div>
                <div className="text-sm text-muted-foreground mt-2">
                  ₹{payModal.amount.toLocaleString()} paid for {payModal.month}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-semibold">Pay Bill</h3>
                  <button
                    onClick={() => setPayModal(null)}
                    className="h-8 w-8 grid place-items-center rounded-lg hover:bg-foreground/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-xl bg-foreground/[0.03] p-4 mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{payModal.month} — {payModal.type}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {payModal.id} · Due: {payModal.due}
                      </div>
                    </div>
                    <div className="text-2xl font-semibold">₹{payModal.amount.toLocaleString()}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Select Payment Method</div>
                  {[
                    { id: "upi", label: "UPI", desc: "Pay via UPI ID or QR code" },
                    { id: "card", label: "Credit / Debit Card", desc: "Visa, Mastercard, RuPay" },
                    { id: "netbanking", label: "Net Banking", desc: "All major banks supported" },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03] hover:bg-foreground/[0.06] cursor-pointer transition"
                    >
                      <input
                        type="radio"
                        name="method"
                        defaultChecked={m.id === "upi"}
                        className="accent-[oklch(from_var(--primary)_l_c_h)]"
                      />
                      <div>
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPayModal(null)}
                    className="h-10 px-4 rounded-lg text-sm font-medium hover:bg-foreground/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={payLoading}
                    className="h-10 px-5 rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-medium shadow-elegant hover:shadow-glow transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {payLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {payLoading ? "Processing..." : `Pay ₹${payModal.amount.toLocaleString()}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
