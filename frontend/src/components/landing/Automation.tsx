import { useEffect, useState } from "react";
import { Bell, Bot, CalendarClock, Receipt } from "lucide-react";
import { fetchPublicLandingStats } from "@/services/supabase/community";

const items = [
  {
    icon: Receipt,
    title: "Auto-billing cycles",
    desc: "Generate maintenance invoices on schedule with smart late-fee handling.",
  },
  {
    icon: Bell,
    title: "Smart alerts",
    desc: "Push the right notification to the right person — never to everyone.",
  },
  {
    icon: CalendarClock,
    title: "Recurring workflows",
    desc: "Schedule cleaning, security shifts, and vendor visits automatically.",
  },
  {
    icon: Bot,
    title: "AI assistant",
    desc: "Ask in plain English: 'Pending dues for Block A' — get instant answers.",
  },
];

export function Automation() {
  const [collected, setCollected] = useState("18,42,500");
  const [stats, setStats] = useState([
    { label: "Open issues", value: "12", tone: "warning" },
    { label: "Visitors today", value: "47", tone: "primary" },
    { label: "Notices sent", value: "8", tone: "accent" },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const data: any = await fetchPublicLandingStats();
        if (data) {
          setCollected(Number(data.processed_bills).toLocaleString("en-IN"));
          setStats([
            { label: "Open issues", value: data.complaints_open.toString(), tone: "warning" },
            { label: "Visitors today", value: data.visitors_today.toString(), tone: "primary" },
            { label: "Notices sent", value: data.notices.toString(), tone: "accent" },
          ]);
        }
      } catch (e) {
        console.error("Failed to load automation stats", e);
      }
    }
    loadData();
  }, []);

  return (
    <section id="automation" className="relative py-28 px-4 sm:px-6 overflow-hidden">
      <div className="absolute inset-0 -z-10 gradient-mesh opacity-30" />
      <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            Smart Automation
          </div>
          <h2 className="mt-4 text-3xl sm:text-5xl font-semibold tracking-tight">
            Less paperwork. <br />
            <span className="text-gradient">More community.</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg">
            Automate the boring parts of running a society — from billing and reminders to vendor
            scheduling — so committees focus on what matters.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {items.map((it) => (
              <div
                key={it.title}
                className="rounded-2xl glass p-5 hover:-translate-y-0.5 transition"
              >
                <div className="grid place-items-center h-10 w-10 rounded-lg bg-[image:var(--gradient-primary)] text-white">
                  <it.icon className="h-4 w-4" />
                </div>
                <div className="mt-4 font-semibold">{it.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{it.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mock dashboard preview */}
        <div className="relative">
          <div
            className="absolute inset-0 -z-10 rounded-[2rem] blur-3xl opacity-40"
            style={{ background: "var(--gradient-hero)" }}
          />
          <div className="rounded-3xl glass-strong shadow-elegant p-6 animate-float">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Maintenance Collected</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight">₹ {collected}</div>
              </div>
              <div className="rounded-lg bg-success/15 text-[color:var(--success)] text-xs font-medium px-2.5 py-1">
                +12.4%
              </div>
            </div>

            <div className="mt-6 grid grid-cols-12 gap-1 h-32 items-end">
              {[40, 55, 38, 72, 60, 80, 68, 90, 75, 85, 95, 88].map((h, i) => (
                <div
                  key={i}
                  className="rounded-md bg-[image:var(--gradient-primary)] opacity-80"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl bg-foreground/5 p-3">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-xl font-semibold">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
