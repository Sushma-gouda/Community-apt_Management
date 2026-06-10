import {
  Users,
  MessageSquareWarning,
  ShieldCheck,
  CreditCard,
  Car,
  Wrench,
  Megaphone,
} from "lucide-react";
import { useState } from "react";

const features = [
  {
    icon: Users,
    title: "Resident Management",
    desc: "Onboard residents, manage families, and track occupancy across blocks and flats.",
  },
  {
    icon: MessageSquareWarning,
    title: "Complaint Tracking",
    desc: "Raise, assign, and resolve issues with SLAs, photos, and live status updates.",
  },
  {
    icon: ShieldCheck,
    title: "Visitor Security",
    desc: "Pre-approvals, OTP entry, photo logs, and gate-pass management for guests.",
  },
  {
    icon: CreditCard,
    title: "Billing & Payments",
    desc: "Automated maintenance invoices, online payments, dues tracking and receipts.",
  },
  {
    icon: Car,
    title: "Parking Management",
    desc: "Allotted slots, vehicle records, guest parking, and violation alerts.",
  },
  {
    icon: Wrench,
    title: "Maintenance Tracking",
    desc: "Schedule preventive maintenance, assign vendors, and monitor budgets.",
  },
  {
    icon: Megaphone,
    title: "Notices & Communication",
    desc: "Push announcements, polls, events and emergency alerts to every resident.",
  },
];

export function Features() {
  const [activeFeature, setActiveFeature] = useState<number | null>(null);

  return (
    <section id="features" className="relative py-28 px-4 sm:px-6">
      <div className="absolute inset-0 -z-10 gradient-mesh opacity-40" />
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <div className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            Platform Features
          </div>
          <h2 className="mt-4 text-3xl sm:text-5xl font-semibold tracking-tight">
            Everything your community <span className="text-gradient">runs on</span>.
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg">
            One unified platform replacing WhatsApp groups, spreadsheets, and paperwork — built for
            modern apartment communities.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              onClick={() => setActiveFeature(activeFeature === i ? null : i)}
              className="cursor-pointer group relative rounded-2xl glass shadow-card p-6 hover:-translate-y-1 transition-all duration-500 overflow-hidden"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-500 -z-10"
                style={{
                  background: "var(--gradient-primary)",
                  filter: "blur(40px)",
                  transform: "translateY(40%)",
                }}
              />
              <div className="grid place-items-center h-12 w-12 rounded-xl bg-[image:var(--gradient-primary)] text-white shadow-glow">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              {activeFeature === i && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed animate-fade-in">{f.desc}</p>
              )}
              <div className="mt-5 inline-flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition">
                {activeFeature === i ? "Show less" : "Learn more →"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
