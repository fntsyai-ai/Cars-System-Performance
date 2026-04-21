"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Filter, Plus, Trash2 } from "lucide-react";
import type { ManualDeal, UnifiedDeal } from "@/lib/queries";
import { createDeal, deleteDeal, updateDeal } from "@/app/actions";
import {
  CANADIAN_PROVINCES,
  UI_STATUS_LABELS,
  cn,
  formatCAD,
  getTodayDateInAppTimeZone,
  type UIStatus,
} from "@/lib/utils";

type FilterState = {
  search: string;
  source: "" | "manual" | "telegram";
  status: "" | UIStatus;
};

export function ScraperDeals({
  deals: initialDeals,
  selectedDay,
}: {
  deals: UnifiedDeal[];
  selectedDay: string;
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [filters, setFilters] = useState<FilterState>({ search: "", source: "", status: "" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDeals(initialDeals);
    setErrorMsg(null);
  }, [initialDeals, selectedDay]);

  const visibleDeals = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();

    return deals.filter((deal) => {
      const source = deal.listing_id ? "telegram" : "manual";
      if (filters.source && filters.source !== source) return false;
      if (filters.status && deal.ui_status !== filters.status) return false;
      if (!needle) return true;

      const haystack = [
        deal.make,
        deal.model ?? "",
        deal.notes ?? "",
        deal.province ?? "",
        deal.listing?.title ?? "",
        deal.listing?.dealer_city ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [deals, filters]);

  const summary = useMemo(() => {
    const telegramVisible = visibleDeals.filter((deal) => deal.listing_id != null).length;
    const manualVisible = visibleDeals.length - telegramVisible;
    const realizedProfit = visibleDeals.reduce((sum, deal) => sum + (Number(deal.profit_cad) || 0), 0);
    return { telegramVisible, manualVisible, realizedProfit };
  }, [visibleDeals]);

  function onCreate(input: Omit<ManualDeal, "id" | "created_at" | "updated_at">) {
    setErrorMsg(null);
    const tempId = `temp-${Date.now()}`;
    const tempDeal: UnifiedDeal = {
      ...input,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      listing: null,
    };

    setDeals((prev) => [tempDeal, ...prev]);

    startTransition(async () => {
      const res = await createDeal(input);
      if (res.error) {
        setErrorMsg(res.error);
        setDeals((prev) => prev.filter((deal) => deal.id !== tempId));
        return;
      }

      if (res.deal) {
        setDeals((prev) =>
          prev.map((deal) =>
            deal.id === tempId ? ({ ...(res.deal as ManualDeal), listing: null } as UnifiedDeal) : deal,
          ),
        );
      }
    });
  }

  function onPatch(id: string, patch: Partial<ManualDeal>) {
    if (id.startsWith("temp-")) return;
    setErrorMsg(null);

    const previous = deals;
    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === id
          ? ({
              ...deal,
              ...patch,
              ui_status: (patch.ui_status ?? patch.stage ?? deal.ui_status) as UIStatus,
              stage: (patch.stage ?? patch.ui_status ?? deal.stage) as UIStatus,
            } as UnifiedDeal)
          : deal,
      ),
    );

    startTransition(async () => {
      const res = await updateDeal(id, patch);
      if (res.error) {
        setErrorMsg(res.error);
        setDeals(previous);
      }
    });
  }

  function onDelete(deal: UnifiedDeal) {
    if (deal.listing_id != null) return;
    if (!confirm("Delete this manual deal?")) return;

    setErrorMsg(null);
    const previous = deals;
    setDeals((prev) => prev.filter((entry) => entry.id !== deal.id));

    startTransition(async () => {
      const res = await deleteDeal(deal.id);
      if (res.error) {
        setErrorMsg(res.error);
        setDeals(previous);
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-ink-500">
          <Filter size={13} strokeWidth={1.6} />
          <span className="eyebrow">Filters</span>
        </div>
        <FilterSelect
          value={filters.source}
          onChange={(value) => setFilters((prev) => ({ ...prev, source: value as FilterState["source"] }))}
          placeholder="All sources"
          options={[
            { value: "telegram", label: "Telegram" },
            { value: "manual", label: "Manual only" },
          ]}
        />
        <FilterSelect
          value={filters.status}
          onChange={(value) => setFilters((prev) => ({ ...prev, status: value as FilterState["status"] }))}
          placeholder="All statuses"
          options={Object.entries(UI_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <input
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="Search title, make, model, notes, location…"
          className="flex-1 min-w-[240px] bg-transparent hairline-b py-2 px-1 text-[13px] text-ink-900 placeholder:text-ink-500 focus:border-clay-500/60 transition-colors"
        />
        <div className="font-mono tabular text-[12px] text-ink-600">
          {visibleDeals.length} visible · {summary.telegramVisible} telegram · {summary.manualVisible} manual ·{" "}
          <span className="text-ink-900">{formatCAD(summary.realizedProfit)}</span>
        </div>
      </div>

      <div className="card rounded-sm overflow-x-auto"><div className="min-w-[1040px]">
        <div className="grid grid-cols-[1.7fr_130px_120px_120px_120px_150px_120px_80px] hairline-b bg-ink-900/[0.025]">
          <Th>Deal</Th>
          <Th>Source</Th>
          <Th>Province</Th>
          <Th>Status</Th>
          <Th align="right">Price</Th>
          <Th>Links</Th>
          <Th align="right">Profit</Th>
          <Th />
        </div>

        <QuickAdd defaultDate={selectedDay || getTodayDateInAppTimeZone()} onAdd={onCreate} />

        {visibleDeals.length === 0 ? (
          <div className="p-16 text-center">
            <div className="eyebrow mb-2">No deals</div>
            <div className="text-ink-500 text-[13px]">
              No linked deals for this day yet. Add a manual one above or switch the date.
            </div>
          </div>
        ) : (
          visibleDeals.map((deal) => (
            <DealRow key={deal.id} deal={deal} onPatch={onPatch} onDelete={onDelete} />
          ))
        )}
      </div></div>

      <div className="mt-3 flex items-center gap-4 min-h-[16px]">
        {isPending && <div className="eyebrow !text-clay-500">Syncing…</div>}
        {errorMsg && <div className="font-mono text-[12px] text-rust-500">{errorMsg}</div>}
      </div>
    </div>
  );
}

function QuickAdd({
  defaultDate,
  onAdd,
}: {
  defaultDate: string;
  onAdd: (deal: Omit<ManualDeal, "id" | "created_at" | "updated_at">) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [province, setProvince] = useState("");
  const [status, setStatus] = useState<UIStatus>("found");
  const [profit, setProfit] = useState("");

  useEffect(() => {
    setDate(defaultDate);
  }, [defaultDate]);

  function submit() {
    if (!make.trim()) return;

    onAdd({
      listing_id: null,
      deal_date: date,
      make: make.trim(),
      model: model.trim() || null,
      province: province || null,
      stage: status,
      ui_status: status,
      profit_cad: profit ? Number(profit) : null,
      notes: null,
    });

    setDate(defaultDate);
    setMake("");
    setModel("");
    setProvince("");
    setStatus("found");
    setProfit("");
  }

  return (
    <div className="grid grid-cols-[1.7fr_130px_120px_120px_120px_150px_120px_80px] hairline-b bg-clay-500/[0.05]">
      <Cell>
        <div className="w-full space-y-2">
          <input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Make *"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full bg-transparent text-[13px] text-ink-900 placeholder:text-ink-500 focus:outline-none"
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model / note"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full bg-transparent text-[12px] text-ink-700 placeholder:text-ink-500 focus:outline-none"
          />
        </div>
      </Cell>
      <Cell>
        <div className="w-full">
          <div className="eyebrow !text-clay-500">Manual</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full bg-transparent text-[12px] font-mono tabular text-ink-700 focus:outline-none"
          />
        </div>
      </Cell>
      <Cell>
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          className="select-chevron w-full bg-transparent text-[13px] font-mono text-ink-900 focus:outline-none cursor-pointer"
        >
          <option value="">—</option>
          {CANADIAN_PROVINCES.map((provinceOption) => (
            <option key={provinceOption.code} value={provinceOption.code}>
              {provinceOption.code}
            </option>
          ))}
        </select>
      </Cell>
      <Cell>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as UIStatus)}
          className="select-chevron w-full bg-transparent text-[13px] text-ink-900 focus:outline-none cursor-pointer"
        >
          {Object.entries(UI_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Cell>
      <Cell align="right">
        <span className="font-mono text-[13px] text-ink-400">—</span>
      </Cell>
      <Cell>
        <span className="text-[12px] text-ink-400">Listing / MMR</span>
      </Cell>
      <Cell align="right">
        <input
          type="number"
          value={profit}
          onChange={(e) => setProfit(e.target.value)}
          placeholder="—"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full bg-transparent text-[13px] font-mono tabular text-right text-ink-900 placeholder:text-ink-500 focus:outline-none"
        />
      </Cell>
      <Cell align="center">
        <button
          onClick={submit}
          aria-label="Add manual deal"
          disabled={!make.trim()}
          className="btn-primary flex h-7 w-7 items-center justify-center rounded-sm disabled:opacity-40"
        >
          <Plus size={13} strokeWidth={2} />
        </button>
      </Cell>
    </div>
  );
}

function DealRow({
  deal,
  onPatch,
  onDelete,
}: {
  deal: UnifiedDeal;
  onPatch: (id: string, patch: Partial<ManualDeal>) => void;
  onDelete: (deal: UnifiedDeal) => void;
}) {
  const muted = deal.ui_status === "no_deal";
  const sourceLabel = deal.listing_id ? "Telegram" : "Manual";
  const displayTitle = deal.listing?.title ?? ([deal.make, deal.model].filter(Boolean).join(" ") || "Untitled deal");
  const displayLocation = deal.province ?? deal.listing?.dealer_city ?? "—";

  return (
    <div
      className={cn(
        "grid grid-cols-[1.7fr_130px_120px_120px_120px_150px_120px_80px] hairline-b last:border-b-0 transition-colors",
        muted ? "bg-ink-900/[0.02] opacity-60" : "hover:bg-ink-900/[0.025]",
      )}
    >
      <Cell>
        <div className="w-full space-y-2">
          <input
            defaultValue={deal.make}
            onBlur={(e) => e.target.value !== deal.make && onPatch(deal.id, { make: e.target.value })}
            className="w-full bg-transparent text-[13px] text-ink-900 focus:outline-none"
          />
          <input
            defaultValue={deal.model ?? deal.notes ?? ""}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value !== (deal.model ?? deal.notes ?? "")) onPatch(deal.id, { model: value || null, notes: null });
            }}
            className="w-full bg-transparent text-[12px] text-ink-700 placeholder:text-ink-500 focus:outline-none"
            placeholder={displayTitle}
          />
          {deal.listing ? (
            <div className="font-mono text-[11px] text-ink-500">
              {displayTitle}
            </div>
          ) : null}
        </div>
      </Cell>
      <Cell>
        <div className="w-full">
          <div className={cn("eyebrow", deal.listing_id ? "!text-clay-500" : "text-ink-500")}>{sourceLabel}</div>
          <input
            type="date"
            defaultValue={deal.deal_date}
            onBlur={(e) => e.target.value !== deal.deal_date && onPatch(deal.id, { deal_date: e.target.value })}
            className="mt-1 w-full bg-transparent text-[12px] font-mono tabular text-ink-700 focus:outline-none"
          />
        </div>
      </Cell>
      <Cell>
        <div className="w-full">
          <select
            value={deal.province ?? ""}
            onChange={(e) => onPatch(deal.id, { province: e.target.value || null })}
            className="select-chevron w-full bg-transparent text-[13px] font-mono text-ink-900 focus:outline-none cursor-pointer"
          >
            <option value="">—</option>
            {CANADIAN_PROVINCES.map((provinceOption) => (
              <option key={provinceOption.code} value={provinceOption.code}>
                {provinceOption.code}
              </option>
            ))}
          </select>
          {!deal.province && deal.listing?.dealer_city ? (
            <div className="mt-1 text-[11px] text-ink-500">{displayLocation}</div>
          ) : null}
        </div>
      </Cell>
      <Cell>
        <select
          value={deal.ui_status}
          onChange={(e) => onPatch(deal.id, { ui_status: e.target.value as UIStatus })}
          className="select-chevron w-full bg-transparent text-[13px] text-ink-900 focus:outline-none cursor-pointer"
        >
          {Object.entries(UI_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Cell>
      <Cell align="right">
        <span className="font-mono text-[13px] tabular text-ink-900">
          {deal.listing?.price != null ? formatCAD(Number(deal.listing.price)) : "—"}
        </span>
      </Cell>
      <Cell>
        <div className="flex flex-col items-start gap-1">
          {deal.listing?.url ? (
            <a
              href={deal.listing.url}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-clay-500 transition-colors hover:text-clay-400"
            >
              Listing
            </a>
          ) : null}
          {deal.listing?.mmr_link ? (
            <a
              href={deal.listing.mmr_link}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-ink-700 transition-colors hover:text-ink-900"
            >
              MMR
            </a>
          ) : (
            <span className="text-[11px] text-ink-400">MMR pending</span>
          )}
        </div>
      </Cell>
      <Cell align="right">
        <input
          type="number"
          defaultValue={deal.profit_cad ?? (deal.listing?.profit_margin != null ? Number(deal.listing.profit_margin) : "")}
          onBlur={(e) => onPatch(deal.id, { profit_cad: e.target.value ? Number(e.target.value) : null })}
          className="w-full bg-transparent text-[13px] font-mono tabular text-right text-ink-900 placeholder:text-ink-500 focus:outline-none"
          placeholder={
            deal.listing?.profit_margin != null ? formatCAD(Number(deal.listing.profit_margin), { sign: true }) : "—"
          }
        />
      </Cell>
      <Cell align="center">
        {deal.listing_id == null ? (
          <button
            onClick={() => onDelete(deal)}
            aria-label="Delete deal"
            className="text-ink-500 transition-colors hover:text-rust-500"
          >
            <Trash2 size={14} strokeWidth={1.8} />
          </button>
        ) : (
          <span className="text-[11px] text-ink-400">Synced</span>
        )}
      </Cell>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="select-chevron rounded-sm border border-ink-900/[0.08] bg-paper-300/60 px-3 py-1.5 text-[12px] text-ink-900 transition-colors cursor-pointer hover:border-clay-500/50"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return <div className={cn("px-4 py-3 eyebrow", align === "right" && "text-right")}>{children}</div>;
}

function Cell({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right" | "center";
}) {
  return (
    <div
      className={cn(
        "flex items-center px-4 py-3",
        align === "right" && "justify-end",
        align === "center" && "justify-center",
      )}
    >
      {children}
    </div>
  );
}
