import { format, isValid, parse } from "date-fns";
import { DATE_PRESET_LABELS, type DatePreset } from "./filters";

export const DATE_STORAGE_FORMAT = "yyyy-MM-dd";
export const DATE_DISPLAY_FORMAT = "dd-MM-yyyy";

export function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = parse(iso, DATE_STORAGE_FORMAT, new Date());
  return isValid(d) ? format(d, DATE_DISPLAY_FORMAT) : iso;
}

export function todayIso(): string {
  return format(new Date(), DATE_STORAGE_FORMAT);
}

export function todayDisplay(): string {
  return format(new Date(), DATE_DISPLAY_FORMAT);
}

export function formatDateRangeLabel(
  preset: DatePreset,
  customFrom: string,
  customTo: string
): string {
  if (preset === "custom") {
    if (customFrom && customTo) return `${fmtDate(customFrom)} – ${fmtDate(customTo)}`;
    if (customFrom) return `From ${fmtDate(customFrom)}`;
    if (customTo) return `Until ${fmtDate(customTo)}`;
    return DATE_PRESET_LABELS.custom;
  }
  return DATE_PRESET_LABELS[preset];
}
