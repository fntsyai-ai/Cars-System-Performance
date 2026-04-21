"use client";

import { useState, useTransition } from "react";
import { signIn } from "./actions";
import { getCurrentYearInAppTimeZone } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

export default function LoginPage() {
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await signIn(fd);
      if (res?.error) setErr(res.error);
    });
  }

  const year = getCurrentYearInAppTimeZone();

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden lg:flex flex-col justify-between p-14 hairline-r overflow-hidden bg-paper-300">
        <div className="absolute inset-0 pointer-events-none opacity-[0.5]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#a86842" strokeWidth="0.3" opacity="0.15" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <header className="relative flex items-center gap-3 rise rise-0">
          <BrandMark />
          <span className="eyebrow">Alex&rsquo;s Ledger</span>
        </header>

        <div className="relative max-w-[560px] rise rise-1">
          <p className="eyebrow mb-6">Private Deal Terminal · Est. 2026</p>
          <h1 className="font-display text-[80px] leading-[0.98] text-ink-900 mb-8">
            Every car.
            <br />
            <span className="italic text-clay-500">Every margin.</span>
            <br />
            One ledger.
          </h1>
          <p className="text-ink-700 max-w-[44ch] text-[15.5px] leading-relaxed">
            A quiet space for the numbers that matter. Found to approved to
            bought — tracked, measured, kept honest.
          </p>
        </div>

        <footer className="relative flex items-end justify-between rise rise-2">
          <div className="eyebrow">No. 001 · Private Build</div>
          <div className="eyebrow">© {year}</div>
        </footer>
      </section>

      <section className="flex items-center justify-center p-8 lg:p-14">
        <form onSubmit={onSubmit} className="w-full max-w-[400px] rise rise-1">
          <div className="lg:hidden mb-12 flex items-center gap-3">
            <BrandMark />
            <span className="eyebrow">Alex&rsquo;s Ledger</span>
          </div>

          <p className="eyebrow mb-3">Sign in</p>
          <h2 className="font-display text-[44px] leading-[1.05] text-ink-900 mb-10">
            Welcome back.
          </h2>

          <div className="space-y-5">
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          </div>

          {err && (
            <p className="mt-5 text-rust-500 text-[13px] font-mono">{err}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="btn-primary mt-8 w-full group relative py-3.5 px-6"
          >
            <span className="relative flex items-center justify-between">
              <span className="tracking-wide font-medium">{isPending ? "Authenticating…" : "Enter Ledger"}</span>
              <span className="font-mono text-[13px] opacity-80 group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </button>

          <p className="mt-10 eyebrow">Session secured · Supabase</p>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow block mb-2">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="w-full bg-transparent border-0 border-b border-ink-900/15 py-3 text-ink-900 placeholder:text-ink-400 focus:border-clay-500 focus:outline-none transition-colors text-[15px]"
      />
    </label>
  );
}
