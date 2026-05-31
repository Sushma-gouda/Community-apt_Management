import {
  LayoutDashboard,
  User,
  Building2,
  MessageSquareWarning,
  CreditCard,
  Car,
  Megaphone,
  Wrench,
  Settings,
} from "lucide-react";
import type { NavItem } from "./DashboardLayout";

export const residentNav: NavItem[] = [
  { label: "Dashboard", to: "/dashboard/resident", icon: LayoutDashboard },
  { label: "My Profile", to: "/dashboard/resident/profile", icon: User },
  { label: "My Flat", to: "/dashboard/resident/flat", icon: Building2 },
  { label: "Complaints", to: "/dashboard/resident/complaints", icon: MessageSquareWarning },
  { label: "Billing", to: "/dashboard/resident/billing", icon: CreditCard },
  { label: "Parking", to: "/dashboard/resident/parking", icon: Car },
  { label: "Notices", to: "/dashboard/resident/notices", icon: Megaphone },
  { label: "Maintenance", to: "/dashboard/resident/maintenance", icon: Wrench },
  { label: "Settings", to: "/dashboard/resident/settings", icon: Settings },
];
