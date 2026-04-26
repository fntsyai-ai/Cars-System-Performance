"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, Filter, Pencil, Plus, StickyNote, Trash2, X } from "lucide-react";
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

const STATUS_OPTIONS: UIStatus[] = [
  "found",
  "approved",
  "bought",
  "no_deal",
  "dealer_didnt_negotiate",
  "already_sold",
  "bad_spec",
  "other",
];

export function ScraperDeals({
  deals: initialDeals,
  selectedDay,
  showDateColumn = false,
  mode = "day",
}: {
  deals: UnifiedDeal[];
  selectedDay: string;
  showDateColumn?: boolean;
  mode?: "day" | "month";
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
        deal.vin ?? "",
        deal.make,
        deal.model ?? "",
        deal.notes ?? "",
        deal.province ?? "",
        deal.title ?? "",
        deal.dealer_city ?? "",
        deal.deal_date,
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

  const tableGridClass = showDateColumn
    ? "grid grid-cols-[120px_340px_130px_210px_120px_120px_120px_150px_120px_110px]"
    : "grid grid-cols-[340px_130px_210px_120px_120px_120px_150px_120px_110px]";
  const tableMinWidthClass = showDateColumn ? "min-w-[1560px]" : "min-w-[1440px]";

  function onCreate(input: Omit<ManualDeal, "id" | "created_at" | "updated_at">) {
    setErrorMsg(null);
    const tempId = `temp-${Date.now()}`;
    const tempDeal: UnifiedDeal = {
      ...input,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
            deal.id === tempId ? (res.deal as ManualDeal) : deal,
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
          options={STATUS_OPTIONS.map((value) => ({ value, label: UI_STATUS_LABELS[value] }))}
        />
        <input
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="Search VIN, title, make, model, notes, location…"
          className="flex-1 min-w-[240px] bg-transparent hairline-b py-2 px-1 text-[13px] text-ink-900 placeholder:text-ink-500 focus:border-clay-500/60 transition-colors"
        />
        <div className="font-mono tabular text-[12px] text-ink-600">
          {visibleDeals.length} visible · {summary.telegramVisible} telegram · {summary.manualVisible} manual ·{" "}
          <span className="text-ink-900">{formatCAD(summary.realizedProfit)}</span>
        </div>
      </div>

      <div className="card rounded-sm overflow-hidden">
        <div className="overflow-x-auto overscroll-x-contain">
          <div className={cn("w-max", tableMinWidthClass)}>
        <div className={cn("hairline-b bg-ink-900/[0.025]", tableGridClass)}>
          {showDateColumn ? <Th>Date</Th> : null}
          <Th>Deal</Th>
          <Th>Source</Th>
          <Th>VIN</Th>
          <Th>Province</Th>
          <Th>Status</Th>
          <Th align="right">Price</Th>
          <Th>Links</Th>
          <Th align="right">Profit</Th>
          <Th />
        </div>

        <QuickAdd
          defaultDate={selectedDay || getTodayDateInAppTimeZone()}
          onAdd={onCreate}
          showDateColumn={showDateColumn}
          gridClass={tableGridClass}
        />

        {visibleDeals.length === 0 ? (
          <div className="p-16 text-center">
            <div className="eyebrow mb-2">No deals</div>
            <div className="text-ink-500 text-[13px]">
              {mode === "month"
                ? "No deals landed in this month yet. Add a manual one above or move to another period."
                : "No linked deals for this day yet. Add a manual one above or switch the date."}
            </div>
          </div>
        ) : (
          visibleDeals.map((deal) => (
            <DealRow
              key={deal.id}
              deal={deal}
              onPatch={onPatch}
              onDelete={onDelete}
              showDateColumn={showDateColumn}
              gridClass={tableGridClass}
            />
          ))
        )}
          </div>
        </div>
      </div>

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
  showDateColumn,
  gridClass,
}: {
  defaultDate: string;
  onAdd: (deal: Omit<ManualDeal, "id" | "created_at" | "updated_at">) => void;
  showDateColumn?: boolean;
  gridClass: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [province, setProvince] = useState("");
  const [status, setStatus] = useState<UIStatus>("found");
  const [profit, setProfit] = useState("");
  const [vin, setVin] = useState("");

  useEffect(() => {
    setDate(defaultDate);
  }, [defaultDate]);

  function submit() {
    if (!make.trim()) return;

    onAdd({
      listing_id: null,
      deal_date: date,
      vin: vin.trim().toUpperCase() || null,
      make: make.trim(),
      model: model.trim() || null,
      province: province || null,
      stage: status,
      ui_status: status,
      profit_cad: profit ? Number(profit) : null,
      notes: null,
      title: null,
      price: null,
      profit_margin: null,
      dealer_city: null,
      url: null,
      mmr_link: null,
      scraped_at: null,
      telegram_sent: null,
    });

    setDate(defaultDate);
    setMake("");
    setModel("");
    setProvince("");
    setStatus("found");
    setProfit("");
    setVin("");
  }

  return (
    <div className={cn("hairline-b bg-clay-500/[0.05]", gridClass)}>
      {showDateColumn ? (
        <Cell>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-transparent text-[12px] font-mono tabular text-ink-700 focus:outline-none"
          />
        </Cell>
      ) : null}
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
          {showDateColumn ? (
            <div className="mt-1 text-[11px] text-ink-500">Custom date</div>
          ) : (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full bg-transparent text-[12px] font-mono tabular text-ink-700 focus:outline-none"
            />
          )}
        </div>
      </Cell>
      <Cell>
        <input
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          placeholder="VIN"
          maxLength={17}
          spellCheck={false}
          autoCapitalize="characters"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full bg-transparent font-mono text-[11.5px] tabular tracking-[0.08em] uppercase text-ink-900 placeholder:text-ink-500 focus:outline-none"
        />
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
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {UI_STATUS_LABELS[value]}
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
  showDateColumn,
  gridClass,
}: {
  deal: UnifiedDeal;
  onPatch: (id: string, patch: Partial<ManualDeal>) => void;
  onDelete: (deal: UnifiedDeal) => void;
  showDateColumn?: boolean;
  gridClass: string;
}) {
  const isBought = deal.ui_status === "bought";
  const sourceLabel = deal.listing_id ? "Telegram" : "Manual";
  const displayTitle = deal.title ?? ([deal.make, deal.model].filter(Boolean).join(" ") || "Untitled deal");
  const displayLocation = deal.province ?? deal.dealer_city ?? "—";

  return (
    <div
      className={cn(
        "hairline-b last:border-b-0 transition-colors",
        gridClass,
        isBought
          ? "bg-sage-500/[0.08] ring-1 ring-inset ring-sage-500/[0.18] hover:bg-sage-500/[0.12]"
          : "hover:bg-ink-900/[0.025]",
      )}
    >
      {showDateColumn ? (
        <Cell>
          <input
            type="date"
            defaultValue={deal.deal_date}
            onBlur={(e) => e.target.value !== deal.deal_date && onPatch(deal.id, { deal_date: e.target.value })}
            className={cn(
              "w-full bg-transparent text-[12px] font-mono tabular focus:outline-none",
              isBought ? "text-sage-700/90" : "text-ink-700",
            )}
          />
        </Cell>
      ) : null}
      <Cell>
        <div className="w-full space-y-2">
          <input
            defaultValue={deal.make}
            onBlur={(e) => e.target.value !== deal.make && onPatch(deal.id, { make: e.target.value })}
            className={cn(
              "w-full bg-transparent text-[13px] focus:outline-none",
              isBought ? "text-sage-700 font-medium" : "text-ink-900",
            )}
          />
          <input
            defaultValue={deal.model ?? ""}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value !== (deal.model ?? "")) onPatch(deal.id, { model: value || null });
            }}
            className={cn(
              "w-full bg-transparent text-[12px] placeholder:text-ink-500 focus:outline-none",
              isBought ? "text-sage-700/90" : "text-ink-700",
            )}
            placeholder={displayTitle}
          />
          {deal.title ? (
            <div className={cn("font-mono text-[11px]", isBought ? "text-sage-700/80" : "text-ink-500")}>
              {displayTitle}
            </div>
          ) : null}
        </div>
      </Cell>
      <Cell>
        <div className="w-full">
          <div
            className={cn(
              "eyebrow",
              isBought ? "!text-sage-600" : deal.listing_id ? "!text-clay-500" : "text-ink-500",
            )}
          >
            {sourceLabel}
          </div>
          <input
            type="date"
            defaultValue={deal.deal_date}
            onBlur={(e) => e.target.value !== deal.deal_date && onPatch(deal.id, { deal_date: e.target.value })}
            className={cn(
              "mt-1 w-full bg-transparent text-[12px] font-mono tabular focus:outline-none",
              isBought ? "text-sage-700/90" : "text-ink-700",
            )}
          />
        </div>
      </Cell>
      <Cell>
        <VinEditor
          deal={deal}
          onPatch={onPatch}
          isBought={isBought}
        />
      </Cell>
      <Cell>
        <div className="w-full">
          <select
            value={deal.province ?? ""}
            onChange={(e) => onPatch(deal.id, { province: e.target.value || null })}
            className={cn(
              "select-chevron w-full bg-transparent text-[13px] font-mono focus:outline-none cursor-pointer",
              isBought ? "text-sage-700" : "text-ink-900",
            )}
          >
            <option value="">—</option>
            {CANADIAN_PROVINCES.map((provinceOption) => (
              <option key={provinceOption.code} value={provinceOption.code}>
                {provinceOption.code}
              </option>
            ))}
          </select>
          {!deal.province && deal.dealer_city ? (
            <div className={cn("mt-1 text-[11px]", isBought ? "text-sage-700/80" : "text-ink-500")}>{displayLocation}</div>
          ) : null}
        </div>
      </Cell>
      <Cell>
        <select
          value={deal.ui_status}
          onChange={(e) => onPatch(deal.id, { ui_status: e.target.value as UIStatus })}
          className={cn(
            "select-chevron w-full bg-transparent text-[13px] focus:outline-none cursor-pointer",
            isBought ? "text-sage-700 font-medium" : "text-ink-900",
          )}
        >
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {UI_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </Cell>
      <Cell align="right">
        <span className={cn("font-mono text-[13px] tabular", isBought ? "text-sage-700" : "text-ink-900")}>
          {deal.price != null ? formatCAD(Number(deal.price)) : "—"}
        </span>
      </Cell>
      <Cell>
        <div className="flex flex-col items-start gap-1">
          {deal.url ? (
            <a
              href={deal.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "text-[12px] transition-colors",
                isBought ? "text-sage-700 hover:text-sage-600" : "text-clay-500 hover:text-clay-400",
              )}
            >
              Listing
            </a>
          ) : null}
          {deal.mmr_link ? (
            <a
              href={deal.mmr_link}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "text-[12px] transition-colors",
                isBought ? "text-sage-700 hover:text-sage-600" : "text-ink-700 hover:text-ink-900",
              )}
            >
              MMR
            </a>
          ) : (
            <span className={cn("text-[11px]", isBought ? "text-sage-700/70" : "text-ink-400")}>MMR pending</span>
          )}
        </div>
      </Cell>
      <Cell align="right">
        <input
          type="number"
          defaultValue={deal.profit_cad ?? (deal.profit_margin != null ? Number(deal.profit_margin) : "")}
          disabled={!isBought}
          onBlur={(e) => onPatch(deal.id, { profit_cad: e.target.value ? Number(e.target.value) : null })}
          className={cn(
            "w-full bg-transparent text-[13px] font-mono tabular text-right placeholder:text-ink-500 focus:outline-none",
            isBought
              ? "text-sage-700 font-medium"
              : "cursor-not-allowed text-ink-500 opacity-85",
          )}
          placeholder={
            deal.profit_margin != null ? formatCAD(Number(deal.profit_margin), { sign: true }) : "—"
          }
        />
      </Cell>
      <Cell align="center">
        <div className="flex items-center gap-3">
          <NoteButton deal={deal} onPatch={onPatch} isBought={isBought} />
          {deal.listing_id == null ? (
            <button
              onClick={() => onDelete(deal)}
              aria-label="Delete deal"
              className={cn(
                "transition-colors",
                isBought ? "text-sage-700/80 hover:text-rust-500" : "text-ink-500 hover:text-rust-500",
              )}
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          ) : (
            <span className={cn("text-[11px]", isBought ? "text-sage-700/75" : "text-ink-400")}>Synced</span>
          )}
        </div>
      </Cell>
    </div>
  );
}

function VinEditor({
  deal,
  onPatch,
  isBought,
}: {
  deal: UnifiedDeal;
  onPatch: (id: string, patch: Partial<ManualDeal>) => void;
  isBought: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(deal.vin ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(deal.vin ?? "");
  }, [editing, deal.vin]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const value = draft.trim().toUpperCase();
    const next = value || null;
    if (next !== (deal.vin ?? null)) onPatch(deal.id, { vin: next });
    setEditing(false);
  }

  function cancel() {
    setDraft(deal.vin ?? "");
    setEditing(false);
  }

  const dirty = draft.trim().toUpperCase() !== (deal.vin ?? "");

  return (
    <div className="w-full">
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            placeholder="VIN"
            maxLength={17}
            spellCheck={false}
            autoCapitalize="characters"
            className={cn(
              "min-w-0 flex-1 bg-transparent font-mono text-[11.5px] tabular tracking-[0.08em] uppercase placeholder:text-ink-500 focus:outline-none border-b border-clay-500/40 focus:border-clay-500 pb-0.5",
              isBought ? "text-sage-700/90" : "text-ink-900",
            )}
          />
          <button
            type="button"
            onClick={commit}
            disabled={!dirty}
            aria-label="Confirm VIN"
            className="text-clay-500 hover:text-clay-400 disabled:text-ink-500 disabled:opacity-40 transition-colors"
          >
            <Check size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label="Discard VIN changes"
            className="text-ink-500 hover:text-rust-500 transition-colors"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 group">
          <div
            className={cn(
              "min-w-0 flex-1 font-mono text-[11.5px] tabular tracking-[0.04em] whitespace-nowrap overflow-hidden text-ellipsis",
              deal.vin ? (isBought ? "text-sage-700/90" : "text-ink-700") : "text-ink-500",
            )}
            title={deal.vin ?? undefined}
          >
            {deal.vin ?? "—"}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={deal.vin ? "Edit VIN" : "Add VIN"}
            title={deal.vin ? "Edit VIN" : "Add VIN"}
            className={cn(
              "transition-colors opacity-60 group-hover:opacity-100 focus:opacity-100",
              isBought ? "text-sage-700/80 hover:text-sage-700" : "text-ink-500 hover:text-clay-500",
            )}
          >
            <Pencil size={11} strokeWidth={1.8} />
          </button>
        </div>
      )}
      {deal.listing_id != null ? (
        <div className={cn("mt-1 text-[11px]", isBought ? "text-sage-700/70" : "text-ink-400")}>
          Linked VIN
        </div>
      ) : null}
    </div>
  );
}

function NoteButton({
  deal,
  onPatch,
  isBought,
}: {
  deal: UnifiedDeal;
  onPatch: (id: string, patch: Partial<ManualDeal>) => void;
  isBought: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(deal.notes ?? "");
  const [mounted, setMounted] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setDraft(deal.notes ?? "");
  }, [open, deal.notes]);

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const POPOVER_WIDTH = Math.min(320, window.innerWidth - 16);
      const MARGIN = 8;
      let left = rect.right - POPOVER_WIDTH;
      const maxLeft = window.innerWidth - POPOVER_WIDTH - MARGIN;
      if (left > maxLeft) left = maxLeft;
      if (left < MARGIN) left = MARGIN;
      setAnchorRect({ top: rect.bottom, left });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function commit(next: string | null) {
    const current = deal.notes ?? null;
    if (next !== current) onPatch(deal.id, { notes: next });
  }

  function save() {
    commit(draft.trim() || null);
    setOpen(false);
  }

  function clearNote() {
    setDraft("");
    commit(null);
    setOpen(false);
  }

  const hasNote = !!deal.notes?.trim();
  const popoverWidth = mounted ? Math.min(320, typeof window !== "undefined" ? window.innerWidth - 16 : 320) : 320;

  const popover = open && mounted && anchorRect ? createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: 2147483000 }}
      onMouseDown={() => save()}
    >
      <div
        role="dialog"
        aria-label="Edit note"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute rounded-sm p-3 border"
        style={{
          top: anchorRect.top + 8,
          left: anchorRect.left,
          width: popoverWidth,
          background: "var(--cypress-raised, #2a3530)",
          borderColor: "var(--hairline, rgba(232,223,203,0.12))",
          boxShadow: "0 16px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="eyebrow">Note</div>
          <span className="font-mono text-[10px] text-ink-500">⌘+Enter to save</span>
        </div>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Dealer name, what happened, why bad…"
          rows={5}
          className="w-full bg-transparent text-[13px] text-ink-900 placeholder:text-ink-500 focus:outline-none resize-none leading-snug"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          {hasNote ? (
            <button
              type="button"
              onClick={clearNote}
              className="px-2 py-1 text-[11px] eyebrow text-ink-500 hover:!text-rust-500 transition-colors"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            className="px-2.5 py-1 text-[11px] eyebrow !text-clay-500 hover:!text-clay-600 border border-clay-500/30 hover:border-clay-500/60 transition-colors rounded-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={hasNote ? "Edit note" : "Add note"}
        title={hasNote ? deal.notes ?? "" : "Add note"}
        className={cn(
          "relative transition-colors",
          hasNote
            ? "!text-clay-500 hover:!text-clay-400"
            : isBought
              ? "text-sage-700/70 hover:text-sage-700"
              : "text-ink-500 hover:text-ink-700",
        )}
      >
        <StickyNote size={14} strokeWidth={1.8} />
        {hasNote ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-clay-500"
          />
        ) : null}
      </button>
      {popover}
    </>
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
