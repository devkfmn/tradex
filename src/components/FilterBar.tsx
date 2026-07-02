import type { Trade } from "../types";
import { DIRECTIONS, GRADES, RESULTS } from "../lib/constants";
import { uniqueSorted, type TradeFilters } from "../lib/filters";

export default function FilterBar({
  trades,
  filters,
  onChange,
  showSearch = true,
  mistakeOptions,
}: {
  trades: Trade[];
  filters: TradeFilters;
  onChange: (f: TradeFilters) => void;
  showSearch?: boolean;
  mistakeOptions?: string[];
}) {
  const coins = uniqueSorted(trades.map((t) => t.coin));
  const setups = uniqueSorted(trades.map((t) => t.setup));
  const mistakes = uniqueSorted([
    ...(mistakeOptions ?? []),
    ...trades.map((t) => t.mistake),
  ]);

  const set = (patch: Partial<TradeFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className="filter-bar">
      {showSearch && (
        <div className="field-search">
          <label>Search</label>
          <input
            placeholder="Search coin, setup, notes…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
      )}
      <div>
        <label>From</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
        />
      </div>
      <div>
        <label>To</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
        />
      </div>
      <div>
        <label>Coin</label>
        <select value={filters.coin} onChange={(e) => set({ coin: e.target.value })}>
          <option value="">All</option>
          {coins.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Direction</label>
        <select
          value={filters.direction}
          onChange={(e) => set({ direction: e.target.value })}
        >
          <option value="">All</option>
          {DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Setup</label>
        <select value={filters.setup} onChange={(e) => set({ setup: e.target.value })}>
          <option value="">All</option>
          {setups.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Grade</label>
        <select value={filters.grade} onChange={(e) => set({ grade: e.target.value })}>
          <option value="">All</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Mistake</label>
        <select
          value={filters.mistake}
          onChange={(e) => set({ mistake: e.target.value })}
        >
          <option value="">All</option>
          {mistakes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Result</label>
        <select
          value={filters.result}
          onChange={(e) => set({ result: e.target.value })}
        >
          <option value="">All</option>
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
