import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/services/supabase/client";
import {
  fetchComplaintsForResident,
  fetchBillsForResident,
  fetchResidentNotices,
  fetchResidentParking,
  fetchVisitorsAll,
  approveVisitorRequest,
  rejectVisitorRequest,
  type ComplaintRow,
  type BillRow,
  type NoticeRow,
  type ParkingDetailed,
  type VisitorDetailed,
} from "@/services/supabase/community";
import {
  Wallet,
  MessageSquareWarning,
  ShieldCheck,
  Megaphone,
  Car,
  Building2,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  XCircle,
  KeyRound
} from "lucide-react";
import { Badge, Card, DashboardLayout, StatCard } from "@/components/dashboard/DashboardLayout";
import { residentNav } from "@/components/dashboard/residentNav";

export const Route = createFileRoute("/dashboard/resident/")({
  head: () => ({ meta: [{ title: "My Dashboard — Communa" }] }),
  component: ResidentDashboard,
});

function ResidentDashboard() {
  const { profile, residentHome } = useAuth();

  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [parking, setParking] = useState<ParkingDetailed | null>(null);
  const [visitors, setVisitors] = useState<VisitorDetailed[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const loadData = async () => {
    if (residentHome?.resident.id) {
      fetchComplaintsForResident(residentHome.resident.id).then(setComplaints);
      fetchBillsForResident(residentHome.resident.id).then(setBills);
    }
    fetchResidentParking().then((slots) => {
      if (slots.length > 0) setParking(slots[0] as any);
    });
    fetchResidentNotices(3).then(setNotices);
    
    // Load visitors
    fetchVisitorsAll().then(data => {
      if (residentHome?.resident.id) {
        setVisitors(data.filter(v => v.resident_id === residentHome.resident.id));
      }
    });
  };

  useEffect(() => {
    loadData();

    if (residentHome?.resident.id) {
      const channel = supabase
        .channel('resident_dashboard_visitors')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'visitors',
          filter: `resident_id=eq.${residentHome.resident.id}`
        }, () => {
          // reload visitors
          fetchVisitorsAll().then(data => {
            setVisitors(data.filter(v => v.resident_id === residentHome.resident.id));
          });
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      }
    }
  }, [residentHome]);

  const handleApprove = async (id: string) => {
    if (!residentHome?.resident.user_id) return;
    setLoadingAction(id);
    const { error } = await approveVisitorRequest(id, residentHome.resident.user_id);
    if (error) alert("Error approving visitor: " + error);
    setLoadingAction(null);
  };

  const handleReject = async (id: string) => {
    setLoadingAction(id);
    const { error } = await rejectVisitorRequest(id);
    if (error) alert("Error rejecting visitor: " + error);
    setLoadingAction(null);
  };

  const displayName = residentHome?.resident.name || profile?.full_name || "Resident";
  const flatDisplay = residentHome
    ? `Flat ${residentHome.flat.flat_number} · ${residentHome.block.name} · ${residentHome.resident.family_count ?? 1} family member(s)`
    : "No flat assigned";

  const unpaidBills = bills.filter((b) => b.status === "pending" || b.status === "overdue");
  const totalUnpaid = unpaidBills.reduce((acc, b) => acc + Number(b.amount), 0);
  const openComplaintsCount = complaints.filter(
    (c) => c.status === "open" || c.status === "in_progress",
  ).length;

  const pendingVisitors = visitors.filter(v => v.status === 'pending');
  const activeVisitors = visitors.filter(v => v.status === 'checked_in');
  const approvedVisitors = visitors.filter(v => v.status === 'approved');

  return (
    <DashboardLayout role="Resident" items={residentNav}>
      <div className="space-y-6 animate-fade-up">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Welcome back, {displayName} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{flatDisplay}</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard/resident/complaints"
              className="inline-flex h-10 px-4 items-center gap-2 rounded-lg glass text-sm font-medium hover:bg-foreground/5 transition"
            >
              <MessageSquareWarning className="h-4 w-4" /> Help
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Outstanding"
            value={`₹${totalUnpaid.toLocaleString()}`}
            change={unpaidBills.length > 0 ? `${unpaidBills.length} bill(s) due` : "All paid"}
            icon={Wallet}
            tone={totalUnpaid > 0 ? "warning" : "success"}
          />
          <StatCard
            label="Complaints"
            value={openComplaintsCount.toString()}
            change={openComplaintsCount > 0 ? "Action required" : "No open issues"}
            icon={MessageSquareWarning}
            tone={openComplaintsCount > 0 ? "warning" : "primary"}
          />
          <StatCard
            label="Parking"
            value={parking ? parking.slot_number : "None"}
            change={parking ? "Assigned" : "Unassigned"}
            icon={Car}
            tone="primary"
          />
          <StatCard
            label="Visitors Inside"
            value={activeVisitors.length.toString()}
            change="Currently visiting"
            icon={UserCheck}
            tone="accent"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Visitor Requests */}
            <Card title="Visitor Requests" className="border-primary/20">
              <div className="space-y-4">
                {pendingVisitors.map(v => (
                  <div key={v.id} className="p-4 rounded-xl bg-background border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{v.name}</span>
                        <Badge tone="warning">Waiting at Gate</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {v.purpose} • {v.visitor_count} person(s)
                        {v.vehicle && ` • Vehicle: ${v.vehicle}`}
                      </div>
                      <div className="text-xs text-muted-foreground/70 mt-1">
                        Arrived: {v.checkIn || "Just now"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleReject(v.id)}
                        disabled={loadingAction === v.id}
                        className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => handleApprove(v.id)}
                        disabled={loadingAction === v.id}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
                
                {approvedVisitors.map(v => (
                  <div key={v.id} className="p-4 rounded-xl bg-accent/5 border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{v.name}</span>
                        <Badge tone="accent">Approved</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Waiting for security to verify OTP.
                      </div>
                    </div>
                    <div className="text-center px-6 py-2 bg-background rounded-lg border border-border">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Entry OTP</div>
                      <div className="text-2xl font-mono tracking-widest font-bold text-primary">{v.otp}</div>
                    </div>
                  </div>
                ))}

                {pendingVisitors.length === 0 && approvedVisitors.length === 0 && (
                  <div className="py-6 text-center">
                    <UserCheck className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No pending visitor requests.</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Notices */}
            <Card
              title="Recent Notices"
              action={
                <Link to="/dashboard/resident/notices" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              }
            >
              <div className="space-y-4">
                {notices.map((n) => (
                  <div key={n.id} className="group cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium group-hover:text-primary transition">
                            {n.title}
                          </h4>
                          {(n.priority === "Urgent" || n.priority === "Important") && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{n.content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                          <Clock className="h-3 w-3" />
                          {new Date(n.publish_date).toLocaleDateString()}
                          <span>•</span>
                          <span className="capitalize">{n.category || "General"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {notices.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground">No recent notices.</div>
                )}
              </div>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Active Visitors inside */}
            {activeVisitors.length > 0 && (
              <Card title="Currently Visiting">
                <div className="space-y-3">
                  {activeVisitors.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded-lg bg-foreground/[0.03]">
                      <div>
                        <div className="text-sm font-medium">{v.name}</div>
                        <div className="text-[10px] text-muted-foreground">Since {v.checkIn}</div>
                      </div>
                      <Badge tone="primary">Inside</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Bills Sidebar */}
            <Card title="Pending Payments">
              <div className="space-y-4">
                {unpaidBills.slice(0, 3).map((b) => (
                  <div key={b.id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{b.label}</div>
                      <div className="text-[10px] text-muted-foreground">Due: {new Date(b.due_date!).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">₹{Number(b.amount).toLocaleString()}</div>
                      <Link to="/dashboard/resident/billing" className="text-[10px] text-primary hover:underline">Pay</Link>
                    </div>
                  </div>
                ))}
                {unpaidBills.length === 0 && (
                  <div className="py-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2 opacity-20" />
                    <p className="text-xs text-muted-foreground">No pending bills</p>
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <Link to="/dashboard/resident/billing" className="text-xs text-center block w-full text-primary font-medium hover:underline">
                    View Billing History
                  </Link>
                </div>
              </div>
            </Card>

            {/* Status Tracking */}
            <Card title="Active Requests">
              <div className="space-y-4">
                {complaints
                  .filter((c) => c.status !== "resolved")
                  .slice(0, 3)
                  .map((c) => (
                    <div key={c.id} className="flex items-start gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-warning shrink-0" />
                      <div>
                        <div className="text-sm font-medium line-clamp-1">{c.title}</div>
                        <div className="text-[10px] text-muted-foreground capitalize">
                          {c.status.replace("_", " ")} · {c.category}
                        </div>
                      </div>
                    </div>
                  ))}
                {complaints.filter((c) => c.status !== "resolved").length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No active requests</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
