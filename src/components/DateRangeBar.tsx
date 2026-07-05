import {
  DATE_PRESET_LABELS,
  type DatePreset,
} from "../lib/filters";

const STORAGE_KEY = "tradex.datePreset";
const LEGACY_STORAGE_KEY = "tradex.dashboard.datePreset";

export function loadDatePreset(): DatePreset {
  try {
    const v =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (v && v in DATE_PRESET_LABELS) {
      if (!localStorage.getItem(STORAGE_KEY) && v) {
        localStorage.setItem(STORAGE_KEY, v);
      }
      return v as DatePreset;
    }
  } catch {
    // ignore
  }
  return "all";
}

export function saveDatePreset(preset: DatePreset): void {
  try {
    localStorage.setItem(STORAGE_KEY, preset);
  } catch {
    // ignore
  }
}

export type { DatePreset };

export default function DateRangeBar({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
}: {
  preset: DatePreset;
  customFrom: string;
  customTo: string;
  onPresetChange: (preset: DatePreset) => void;
  onCustomFromChange: (from: string) => void;
  onCustomToChange: (to: string) => void;
}) {
  const presets: DatePreset[] = ["all", "30d", "90d", "month", "custom"];

  return (
    <div className="date-range-bar">
      <div className="date-range-presets">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className={`date-preset-btn ${preset === p ? "active" : ""}`}
            onClick={() => onPresetChange(p)}
          >
            {DATE_PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="date-range-custom">
          <div>
            <label>From</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
            />
          </div>
          <div>
            <label>To</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
