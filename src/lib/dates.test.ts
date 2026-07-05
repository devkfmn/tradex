import { describe, expect, it } from "vitest";
import {
  DATE_DISPLAY_FORMAT,
  fmtDate,
  formatDateRangeLabel,
  todayDisplay,
  todayIso,
} from "./dates";

describe("fmtDate", () => {
  it("formats ISO dates as dd-MM-yyyy", () => {
    expect(fmtDate("2026-07-05")).toBe("05-07-2026");
    expect(fmtDate("2025-01-01")).toBe("01-01-2025");
  });

  it("returns empty string for empty input", () => {
    expect(fmtDate("")).toBe("");
  });

  it("returns input unchanged when not valid ISO", () => {
    expect(fmtDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDateRangeLabel", () => {
  it("uses preset labels for non-custom presets", () => {
    expect(formatDateRangeLabel("all", "", "")).toBe("All time");
    expect(formatDateRangeLabel("30d", "", "")).toBe("Last 30 days");
  });

  it("formats custom ranges with dd-MM-yyyy", () => {
    expect(formatDateRangeLabel("custom", "2026-01-01", "2026-07-05")).toBe(
      "01-01-2026 – 05-07-2026"
    );
    expect(formatDateRangeLabel("custom", "2026-01-01", "")).toBe("From 01-01-2026");
    expect(formatDateRangeLabel("custom", "", "2026-07-05")).toBe("Until 05-07-2026");
    expect(formatDateRangeLabel("custom", "", "")).toBe("Custom");
  });
});

describe("today helpers", () => {
  it("todayIso uses yyyy-MM-dd", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("todayDisplay uses dd-MM-yyyy", () => {
    expect(todayDisplay()).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(DATE_DISPLAY_FORMAT).toBe("dd-MM-yyyy");
  });
});
