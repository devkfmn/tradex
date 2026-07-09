import { addTrade } from "./trades";
import type { MexcClosedPositionDto, TradeInput } from "../types";

export async function importMexcClosedPositions(
  uid: string,
  positions: MexcClosedPositionDto[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const pos of positions) {
    const input: TradeInput = {
      date: pos.date,
      coin: pos.coin,
      direction: pos.direction,
      setup: "",
      riskPct: null,
      riskUsd: null,
      pnl: pos.pnl,
      realizedR: null,
      grade: "",
      mistakes: [],
      postNotes: pos.postNotes,
      screenshotUrls: [],
      entry: pos.entry,
      stop: null,
      target: null,
      timeframe: "",
      session: "",
      marketCondition: "",
      exitReason: "",
      plannedR: null,
      maxFavorableR: null,
      maxAdverseR: null,
      thesis: "",
      status: "review",
      source: "mexc",
      mexcPositionId: pos.mexcPositionId,
    };

    const id = await addTrade(uid, input);
    ids.push(id);
  }

  return ids;
}
