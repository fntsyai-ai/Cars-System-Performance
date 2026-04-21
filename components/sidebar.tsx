"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";
import { LayoutDashboard, TableProperties, BarChart3, LogOut } from "lucide-react";

const nav = [
  { href: "/", label: "Ledger", icon: LayoutDashboard, numeral: "I" },
  { href: "/deals", label: "Deal Log", icon: TableProperties, numeral: "II" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, numeral: "III" },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] shrink-0 hairline-r flex flex-col h-screen sticky top-0 bg-paper-100">
      <div className="p-6 hairline-b">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className="absolute inset-0 border border-clay-500/50 rotate-45" />
            <span className="relative font-display text-clay-500 text-xl italic">A</span>
          </div>
          <div>
            <div className="font-display text-[18px] text-ink-900 leading-none">Alex&rsquo;s Ledger</div>
            <div className="eyebrow mt-1.5">Deal Terminal · v1</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <div className="eyebrow px-3 py-3">Sections</div>
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 text-[14px] transition-colors relative rounded-sm",
                active
                  ? "text-ink-900 bg-clay-500/[0.07]"
                  : "text-ink-700 hover:text-ink-900 hover:bg-ink-900/[0.03]",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-clay-500" />
              )}
              <span className={cn("font-mono text-[10px] w-5", active ? "text-clay-500" : "text-ink-400")}>
                {item.numeral}
              </span>
              <Icon size={15} strokeWidth={1.6} className={cn(active ? "text-clay-500" : "text-ink-500")} />
              <span className="tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 hairline-t">
        <div className="px-3 pb-3">
          <div className="eyebrow mb-1.5">Signed in</div>
          <div className="text-[13px] text-ink-900 truncate">{userEmail}</div>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-between px-3 py-2.5 text-[13px] text-ink-700 hover:text-rust-500 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <LogOut size={14} strokeWidth={1.6} />
            <span>Sign out</span>
          </span>
          <span className="font-mono text-[10px] text-ink-400">⌥⇧Q</span>
        </button>
      </div>
    </aside>
  );
}
