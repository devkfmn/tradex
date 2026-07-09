import { MexcApiError } from "./futuresAssets.js";
import { buildMexcGetRequestParam, signMexcFuturesRequest } from "./signing.js";

const MEXC_FUTURES_BASE = "https://contract.mexc.com";
const HISTORY_POSITIONS_PATH = "/api/v1/private/position/list/history_positions";
const PAGE_SIZE = 100;

export interface MexcHistoryPosition {
  positionId: number | string;
  symbol: string;
  positionType: number;
  state?: number;
  positionShowStatus?: string;
  openAvgPrice?: number | string;
  newOpenAvgPrice?: number | string;
  closeAvgPrice?: number | string;
  newCloseAvgPrice?: number | string;
  realised?: number | string;
  leverage?: number;
  fee?: number | string;
  holdFee?: number | string;
  createTime?: number;
  updateTime?: number;
}

export interface MexcClosedPositionDto {
  mexcPositionId: string;
  coin: string;
  direction: "Long" | "Short";
  entry: number | null;
  closePrice: number | null;
  pnl: number | null;
  date: string;
  leverage: number | null;
  fee: number | null;
  holdFee: number | null;
  postNotes: string;
}

interface MexcHistoryPageData {
  resultList?: MexcHistoryPosition[];
  totalPage?: number;
  currentPage?: number;
}

interface MexcHistoryResponse {
  success?: boolean;
  code?: number;
  message?: string;
  data?: MexcHistoryPosition[] | MexcHistoryPageData;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mexcSymbolToCoin(symbol: string): string {
  const base = symbol.split("_")[0] ?? symbol;
  return base.trim().toUpperCase();
}

export function mexcPositionTypeToDirection(
  positionType: number
): "Long" | "Short" {
  return positionType === 2 ? "Short" : "Long";
}

export function isClosedMexcPosition(pos: MexcHistoryPosition): boolean {
  if (pos.positionShowStatus === "CLOSED") return true;
  return pos.state === 3;
}

export function mexcTimestampToDate(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms)) {
    return new Date().toISOString().slice(0, 10);
  }
  return new Date(ms).toISOString().slice(0, 10);
}

export function buildMexcPostNotes(pos: MexcHistoryPosition): string {
  const parts: string[] = ["Imported from MEXC futures."];
  const closePrice = toNumber(pos.newCloseAvgPrice ?? pos.closeAvgPrice);
  const leverage = pos.leverage;
  const fee = toNumber(pos.fee);
  const holdFee = toNumber(pos.holdFee);

  if (closePrice != null) parts.push(`Close: ${closePrice}`);
  if (leverage != null) parts.push(`Leverage: ${leverage}x`);
  if (fee != null) parts.push(`Fee: ${fee}`);
  if (holdFee != null) parts.push(`Funding: ${holdFee}`);

  return parts.join(" ");
}

export function mapMexcPositionToDto(
  pos: MexcHistoryPosition
): MexcClosedPositionDto {
  return {
    mexcPositionId: String(pos.positionId),
    coin: mexcSymbolToCoin(pos.symbol),
    direction: mexcPositionTypeToDirection(pos.positionType),
    entry: toNumber(pos.newOpenAvgPrice ?? pos.openAvgPrice),
    closePrice: toNumber(pos.newCloseAvgPrice ?? pos.closeAvgPrice),
    pnl: toNumber(pos.realised),
    date: mexcTimestampToDate(pos.updateTime ?? pos.createTime),
    leverage: pos.leverage ?? null,
    fee: toNumber(pos.fee),
    holdFee: toNumber(pos.holdFee),
    postNotes: buildMexcPostNotes(pos),
  };
}

function extractPositionsFromResponse(
  body: MexcHistoryResponse
): { positions: MexcHistoryPosition[]; totalPage: number; currentPage: number } {
  if (body.success === false) {
    throw new MexcApiError(body.message ?? "MEXC request failed");
  }

  const data = body.data;
  if (Array.isArray(data)) {
    return { positions: data, totalPage: 1, currentPage: 1 };
  }

  if (data && Array.isArray(data.resultList)) {
    return {
      positions: data.resultList,
      totalPage: data.totalPage ?? 1,
      currentPage: data.currentPage ?? 1,
    };
  }

  throw new MexcApiError("Unexpected MEXC history positions response format");
}

async function fetchHistoryPositionsPage(
  apiKey: string,
  apiSecret: string,
  startTimeMs: number,
  endTimeMs: number,
  pageNum: number,
  fetchFn: typeof fetch
): Promise<{
  positions: MexcHistoryPosition[];
  totalPage: number;
  currentPage: number;
}> {
  const queryParams = buildMexcGetRequestParam({
    page_num: pageNum,
    page_size: PAGE_SIZE,
    start_time: startTimeMs,
    end_time: endTimeMs,
  });

  const { timestamp, signature } = signMexcFuturesRequest(
    apiKey,
    apiSecret,
    queryParams
  );

  const url = `${MEXC_FUTURES_BASE}${HISTORY_POSITIONS_PATH}?${queryParams}`;
  const res = await fetchFn(url, {
    method: "GET",
    headers: {
      ApiKey: apiKey,
      "Request-Time": timestamp,
      Signature: signature,
      "Content-Type": "application/json",
    },
  });

  let body: MexcHistoryResponse;
  try {
    body = (await res.json()) as MexcHistoryResponse;
  } catch {
    throw new MexcApiError(
      `MEXC returned invalid JSON (${res.status})`,
      res.status
    );
  }

  if (!res.ok) {
    throw new MexcApiError(
      body.message ?? `MEXC request failed (${res.status})`,
      res.status
    );
  }

  return extractPositionsFromResponse(body);
}

export async function fetchMexcClosedPositions(
  apiKey: string,
  apiSecret: string,
  startTimeMs: number,
  endTimeMs: number = Date.now(),
  fetchFn: typeof fetch = fetch
): Promise<MexcClosedPositionDto[]> {
  const trimmedKey = apiKey.trim();
  const trimmedSecret = apiSecret.trim();
  if (!trimmedKey || !trimmedSecret) {
    throw new MexcApiError("API key and secret are required");
  }

  const allPositions: MexcHistoryPosition[] = [];
  let pageNum = 1;
  let totalPage = 1;

  do {
    const page = await fetchHistoryPositionsPage(
      trimmedKey,
      trimmedSecret,
      startTimeMs,
      endTimeMs,
      pageNum,
      fetchFn
    );
    allPositions.push(...page.positions);
    totalPage = page.totalPage;
    pageNum = page.currentPage + 1;
  } while (pageNum <= totalPage);

  return allPositions
    .filter(isClosedMexcPosition)
    .map(mapMexcPositionToDto);
}
