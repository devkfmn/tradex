import {
  getAI,
  getGenerativeModel,
  Schema,
  VertexAIBackend,
  type GenerativeModel,
} from "firebase/ai";
import app, { firebaseReady } from "../lib/firebase";
import type { ReportSnapshot } from "../lib/reportSnapshot";

export interface ReportSummaryResult {
  summary: string;
  suggestions: string[];
}

export function aiSummaryAvailable(): boolean {
  return firebaseReady;
}

function buildPrompt(snapshot: ReportSnapshot): string {
  const filterNote =
    Object.keys(snapshot.activeFilters).length > 0
      ? `\nActive filters: ${JSON.stringify(snapshot.activeFilters)}`
      : "";

  return `Analyze this trading journal snapshot and write a sharp coaching brief. Period: "${snapshot.rangeLabel}" (${snapshot.from || "start"} to ${snapshot.to || "present"}), ${snapshot.tradeCount} trades.

Rules:
- Use ONLY numbers and labels from the snapshot. Never invent data.
- Cross-reference ALL sections: overall, long vs short, setups, mistakes, coins, sessions, weekdays, grades, market conditions, timeframes, planned R vs actual, excursions (data coverage, portfolio capture/left-on-table, win/loss MFE/MAE splits, winners/losers detail, exit reasons with MFE/MAE).
- Prefer R; use $ only when netPnl is present and meaningful.
- Flag low sample size (1–2 trades) when leaning on a group.

Summary (2–4 sentences):
- Lead with net R, win rate, and expectancy for the period.
- Name the #1 edge (best setup, direction, session, or coin with supporting numbers).
- Name the #1 leak (worst mistake, setup, direction, weekday, or exit pattern with supporting numbers).
- If excursions.dataCoverage.missingBoth > 0, note incomplete excursion logging.
- If excursions.winners.avgLeftOnTableR is high, suggest exit management. If excursions.losers.countWentGreenBeforeLoss > 0, mention giving back green before stop.
- No filler, no generic psychology, no restating the obvious.

Suggestions (4–6 items, highest impact first):
Each line MUST follow: "[Action]: [specific label from data] — [metric] — [concrete change]."
Examples of good items:
- "Cut: FOMO entry mistakes — -3.2R over 5 trades — skip entries without a tagged setup."
- "Double down: Breakout retest — +4.1R, 62% win — allocate more size only to this setup in London session."
Examples of BAD items (never output these):
- "Improve discipline" / "Review your journal" / "Manage risk better" without naming what to stop or start.

Skip suggestions for one-off groups unless they contain the largest single loss. Prefer changes that would have avoided the worst R drag or scaled the best R driver.

Full snapshot:
${JSON.stringify(snapshot, null, 2)}${filterNote}`;
}

let modelInstance: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!modelInstance) {
    const ai = getAI(app, { backend: new VertexAIBackend() });
    modelInstance = getGenerativeModel(ai, {
      model: "gemini-2.5-flash-lite",
      systemInstruction:
        "Expert trading coach. Every claim must cite snapshot data. Action items must name specific setups, mistakes, coins, sessions, or days. No generic advice. Output only valid JSON.",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: Schema.object({
          properties: {
            summary: Schema.string({
              description:
                "2-4 dense sentences with specific numbers: net result, main edge, main leak",
            }),
            suggestions: Schema.array({
              items: Schema.string(),
              description:
                "4-6 concrete actions naming a snapshot label + metric + behavior change, impact-ordered",
            }),
          },
        }),
      },
    });
  }
  return modelInstance;
}

function parseSummaryResponse(text: string): ReportSummaryResult {
  const parsed = JSON.parse(text) as Partial<ReportSummaryResult>;
  if (!parsed.summary || typeof parsed.summary !== "string") {
    throw new Error("Invalid summary response");
  }
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Invalid summary response");
  }
  return {
    summary: parsed.summary.trim(),
    suggestions: parsed.suggestions
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6),
  };
}

export async function generateReportSummary(
  snapshot: ReportSnapshot
): Promise<ReportSummaryResult> {
  if (!firebaseReady) {
    throw new Error("Firebase is not configured");
  }

  const result = await getModel().generateContent(buildPrompt(snapshot));
  return parseSummaryResponse(result.response.text());
}
