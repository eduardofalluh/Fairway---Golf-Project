"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Sheet } from "../ui/Sheet";
import { useSearch } from "./SearchProvider";
import { DateField, FlexField, MarketToggle, PlayersField, TimeField } from "./SearchFields";
import { scrollToId } from "../SmoothScroll";
import { formatPrice } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { DEFAULT_FILTERS } from "@/lib/search-state";
import { MARKET_REGIONS, type Region } from "@/lib/types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[.2em] text-fog">{title}</h3>
      {children}
    </section>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl px-1 text-left text-[15px] font-medium text-cream"
    >
      {label}
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-forest" : "bg-line"}`}>
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={`absolute top-1 size-5 rounded-full bg-surface shadow ${checked ? "right-1" : "left-1"}`}
        />
      </span>
    </button>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  layoutId,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  layoutId: string;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-2xl bg-base-2 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className="relative min-h-11 flex-1 rounded-xl text-sm font-semibold"
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-surface shadow-[0_4px_14px_rgba(22,45,34,.12)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={`relative ${active ? "text-cream" : "text-fog"}`}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FiltersSheet() {
  const { filtersOpen, setFiltersOpen, filters, setFilters, resetFilters, draft, query, submit, results } = useSearch();
  const { t } = useLanguage();
  const close = () => setFiltersOpen(false);
  const dirty =
    draft.date !== query.date || draft.desiredTime !== query.desiredTime || draft.windowMinutes !== query.windowMinutes;
  const regions = MARKET_REGIONS[query.market];
  const toggleRegion = (region: Region) =>
    setFilters({
      regions: filters.regions.includes(region)
        ? filters.regions.filter((r) => r !== region)
        : [...filters.regions, region],
    });
  const maxPrice = filters.maxPrice ?? DEFAULT_FILTERS.maxPrice ?? 250;

  return (
    <Sheet
      open={filtersOpen}
      onClose={close}
      title={t.filters.title}
      titleId="filters-title"
      closeLabel={t.filters.close}
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-12 rounded-xl px-3 text-sm font-semibold text-fog underline-offset-4 hover:text-cream hover:underline"
          >
            {t.filters.reset}
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (dirty) submit();
              close();
              window.setTimeout(() => scrollToId("results"), 250);
            }}
            className="shine min-h-12 flex-1 rounded-2xl bg-forest px-5 text-[15px] font-bold text-white transition-colors hover:bg-forest-soft"
          >
            {dirty ? t.search.find : t.filters.show(results.length)}
          </motion.button>
        </div>
      }
    >
      <div className="grid gap-6">
        <Section title={t.filters.yourRound}>
          <div className="mb-3">
            <MarketToggle tone="light" layoutId="market-pill-sheet" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DateField tone="light" className="col-span-2" />
            <TimeField tone="light" />
            <FlexField tone="light" />
            <PlayersField tone="light" className="col-span-2" />
          </div>
        </Section>

        <Section title={t.filters.refine}>
          <div className="grid gap-5">
            <div>
              <p className="mb-2 text-sm font-medium text-cream">{t.filters.holes}</p>
              <Segmented
                label={t.filters.holes}
                layoutId="holes-pill"
                value={String(filters.holes)}
                onChange={(v) => setFilters({ holes: v === "any" ? "any" : v === "9" ? 9 : 18 })}
                options={[
                  { value: "any", label: t.filters.any },
                  { value: "18", label: t.filters.holesValue(18) },
                  { value: "9", label: t.filters.holesValue(9) },
                ]}
              />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="max-price" className="text-sm font-medium text-cream">{t.filters.maxPrice}</label>
                <span className="font-display text-xl font-semibold tabular-nums text-forest">
                  {maxPrice >= 250 ? `${formatPrice(250)}+` : formatPrice(maxPrice)}
                </span>
              </div>
              <input
                id="max-price"
                type="range"
                min={20}
                max={250}
                step={5}
                value={maxPrice}
                onChange={(e) => setFilters({ maxPrice: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="target-price" className="text-sm font-medium text-cream">{t.filters.targetBudget}</label>
                <span className="font-display text-xl font-semibold tabular-nums text-forest">
                  {filters.targetPrice != null ? formatPrice(filters.targetPrice) : "—"}
                </span>
              </div>
              <input
                id="target-price"
                type="range"
                min={20}
                max={250}
                step={5}
                value={filters.targetPrice ?? 70}
                onChange={(e) => setFilters({ targetPrice: Number(e.target.value) })}
                className="w-full"
              />
              <p className="mt-2 text-xs leading-5 text-fog">{t.filters.targetHint}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-cream">{t.filters.regions}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={filters.regions.length === 0}
                  onClick={() => setFilters({ regions: [] })}
                  className={`min-h-10 rounded-full border px-4 text-sm font-medium transition ${
                    filters.regions.length === 0 ? "border-forest bg-forest text-white" : "border-line text-fog hover:border-forest/50"
                  }`}
                >
                  {t.filters.allRegions}
                </button>
                {regions.map((region) => {
                  const active = filters.regions.includes(region);
                  return (
                    <motion.button
                      key={region}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      aria-pressed={active}
                      onClick={() => toggleRegion(region)}
                      className={`min-h-10 rounded-full border px-4 text-sm font-medium transition ${
                        active ? "border-forest bg-forest text-white" : "border-line text-fog hover:border-forest/50"
                      }`}
                    >
                      {region}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-line rounded-2xl border border-line px-3">
              <Switch checked={filters.publicOnly} onChange={(v) => setFilters({ publicOnly: v })} label={t.filters.publicOnly} />
              <Switch checked={filters.cartOnly} onChange={(v) => setFilters({ cartOnly: v })} label={t.filters.cartOnly} />
            </div>
          </div>
        </Section>
      </div>
    </Sheet>
  );
}
