import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchVisitorsAll,
  checkoutVisitor,
  verifyVisitorOtpAndCheckIn,
  type VisitorDetailed,
} from "@/services/supabase/community";
import {
  UserCheck,
  ShieldCheck,
  Car,
  AlertTriangle,
  LogIn,
  LogOut,
  Clock,
  TrendingUp,
  KeyRound,
  X
} from "lucide-react";
import { Badge, Card, DashboardLayout, StatCard } from "@/components/dashboard/DashboardLayout";
import { securityNav } from "@/components/dashboard/securityNav";
import { supabase } from "@/services/supabase/client";

export const Route = createFileRoute("/dashboard/security/")({
  head: () => ({ meta: [{ title: "Security Dashboard — Communa" }] }),
  component: SecurityDashboard,
});

function SecurityDashboard() {
  const [visitors, setVisitors] = useState<VisitorDetailed[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  // OTP Modal State
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorDetailed | null>(null);
  const [otpInput, setOtpInput] = useState(["", "", "", "", "", ""]);
  const [parkingSlot, setParkingSlot] = useState("");

  const fetchLogs = async () => {
    const data = await fetchVisitorsAll();
    setVisitors(data);
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel("security_dashboard_visitors_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCheckout = async (id: string) => {
    setLoadingAction(id);
    await checkoutVisitor(id);
    await fetchLogs();
    setLoadingAction(null);
  };

  const handleVerifyOtp = async () => {
    if (!selectedVisitor) return;
    const otp = otpInput.join("");
    if (otp.length !== 6) {
      alert("Please enter a valid 6-digit OTP.");
      return;
    }

    setLoadingAction(selectedVisitor.id);
    const { error } = await verifyVisitorOtpAndCheckIn(selectedVisitor.id, otp, parkingSlot || undefined);
    
    if (error) {
      alert("Verification failed: " + error);
      setLoadingAction(null);
      return;
    }

    setVerifyModalOpen(false);
    setSelectedVisitor(null);
    setOtpInput(["", "", "", "", "", ""]);
    setParkingSlot("");
    await fetchLogs();
    setLoadingAction(null);
  };

  const activeVisitors = visitors.filter((v) => v.status === "checked_in");
  const pendingApprovals = visitors.filter((v) => v.status === "pending");
  const approvedWaiting = visitors.filter((v) => v.status === "approved");
  
  const todaysEntries = visitors.filter((v) => {
    if (!v.entry_time_raw) return false;
    return new Date(v.entry_time_raw).toDateString() === new Date().toDateString();
  }).length;

  return (
    <DashboardLayout role="Security" items={securityNav}>
      <div className="space-y-6 animate-fade-up relative">
        
        {/* OTP Verification Modal */}
        {verifyModalOpen && selectedVisitor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setVerifyModalOpen(false)} />
            <div className="relative bg-card border border-border rounded-xl shadow-elegant w-full max-w-md p-6">
              <button 
                onClick={() => setVerifyModalOpen(false)}
                className="absolute top-4 right-4 p-1 text-muted-foreground hover:bg-foreground/5 rounded-md transition"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="text-center mb-6">
                <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">Verify OTP</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the 6-digit code for {selectedVisitor.name}
                </p>
              </div>

              <div className="flex justify-center gap-2 mb-6">
                {otpInput.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const next = [...otpInput];
                      next[i] = val;
                      setOtpInput(next);
                      if (val && i < 5) {
                        document.getElementById(`otp-${i + 1}`)?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !digit && i > 0) {
                        document.getElementById(`otp-${i - 1}`)?.focus();
                      }
                    }}
                    className="w-10 h-12 text-center text-xl font-semibold rounded-lg bg-foreground/5 border border-transparent focus:border-primary focus:bg-background outline-none transition-colors"
                  />
                ))}
              </div>

              {selectedVisitor.vehicle && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1">Assign Parking Slot (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. V-12"
                    value={parkingSlot}
                    onChange={(e) => setParkingSlot(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-foreground/5 border border-transparent focus:bg-background focus:border-input outline-none transition-colors"
                  />
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loadingAction === selectedVisitor.id || otpInput.join("").length !== 6}
                className="w-full h-10 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loadingAction === selectedVisitor.id ? "Verifying..." : "Verify & Allow Entry"}
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Gate Operations</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage visitor requests, check-ins, and logs.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard/security/add-visitor"
              className="inline-flex h-10 px-4 items-center rounded-lg bg-[image:var(--gradient-primary)] text-white text-sm font-medium shadow-elegant gap-2 hover:shadow-glow transition"
            >
              <LogIn className="h-4 w-4" /> Add Visitor
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pending Approvals"
            value={pendingApprovals.length.toString()}
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Approved (Waiting)"
            value={approvedWaiting.length.toString()}
            icon={KeyRound}
            tone="accent"
          />
          <StatCard
            label="Visitors Inside"
            value={activeVisitors.length.toString()}
            icon={UserCheck}
            tone="primary"
          />
          <StatCard
            label="Today's Entries"
            value={todaysEntries.toString()}
            icon={ShieldCheck}
            tone="success"
          />
        </div>

        {/* Approved & Waiting for Check In */}
        {approvedWaiting.length > 0 && (
          <Card title={`Approved Visitors (${approvedWaiting.length})`} className="border-accent/30 bg-accent/5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {approvedWaiting.map((v) => (
                <div key={v.id} className="rounded-xl bg-background border border-border p-4 hover:shadow-md transition">
                  <div className="flex items-center gap-3">
                    <div className="grid place-items-center h-10 w-10 rounded-full bg-accent text-accent-foreground font-semibold text-sm shrink-0">
                      {v.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground">→ {v.flat} ({v.host})</div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedVisitor(v);
                        setVerifyModalOpen(true);
                      }}
                      className="flex-1 text-xs px-3 py-1.5 rounded-md bg-accent text-accent-foreground font-medium hover:opacity-90 transition-opacity"
                    >
                      Verify OTP & Check In
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Active visitors */}
        <Card
          title={`Checked-In Visitors (${activeVisitors.length})`}
          action={
            <Link
              to="/dashboard/security/active-visitors"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          }
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeVisitors.slice(0, 6).map((v) => (
              <div key={v.id} className="rounded-xl glass p-4 hover:shadow-card transition">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center h-10 w-10 rounded-full bg-[image:var(--gradient-primary)] text-white font-semibold text-sm shrink-0">
                    {v.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{v.name}</div>
                    <div className="text-[11px] text-muted-foreground">→ {v.flat}</div>
                  </div>
                  <Badge tone={v.purpose === "Guest" ? "primary" : "accent"}>{v.purpose}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <LogIn className="h-3 w-3" />{" "}
                    {v.checkIn || "Just now"}
                  </span>
                  <button
                    onClick={() => void handleCheckout(v.id)}
                    disabled={loadingAction === v.id}
                    className="text-xs text-destructive hover:underline font-medium disabled:opacity-50"
                  >
                    {loadingAction === v.id ? "Checking out..." : "Check Out"}
                  </button>
                </div>
              </div>
            ))}
            {activeVisitors.length === 0 && (
              <div className="col-span-full py-6 text-center text-sm text-muted-foreground">
                No active visitors inside.
              </div>
            )}
          </div>
        </Card>

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Live log */}
          <div className="lg:col-span-2">
            <Card
              title="Recent Activity"
              action={
                <Link
                  to="/dashboard/security/visitor-logs"
                  className="text-xs text-primary hover:underline"
                >
                  Full log
                </Link>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-2 py-2 font-medium">Visitor</th>
                      <th className="px-2 py-2 font-medium">Flat</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.slice(0, 10).map((v) => (
                      <tr
                        key={v.id}
                        className="border-b border-border last:border-0 hover:bg-foreground/[0.02]"
                      >
                        <td className="px-2 py-3 font-medium">{v.name}</td>
                        <td className="px-2 py-3">{v.flat}</td>
                        <td className="px-2 py-3">
                          <Badge tone={
                            v.status === 'pending' ? 'warning' :
                            v.status === 'approved' ? 'accent' :
                            v.status === 'checked_in' ? 'primary' :
                            v.status === 'rejected' ? 'danger' : 'muted'
                          }>
                            {v.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 text-foreground/80">
                          {v.date} {v.checkIn}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Pending Requests */}
            <Card title="Pending Approvals">
              <div className="space-y-3">
                {pendingApprovals.slice(0, 5).map(v => (
                  <div key={v.id} className="p-3 rounded-lg bg-foreground/5 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-xs text-muted-foreground">{v.date}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Waiting for {v.flat} ({v.host}) to approve.</div>
                  </div>
                ))}
                {pendingApprovals.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No pending requests.
                  </div>
                )}
              </div>
            </Card>

            {/* Incident */}
            <Card title="Active Incidents" action={<Badge tone="danger">0 open</Badge>}>
              <div className="mt-4 text-sm text-muted-foreground">
                No active incidents in the last 24h.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
