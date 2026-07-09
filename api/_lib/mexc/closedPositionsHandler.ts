import { MexcApiError } from "./futuresAssets.js";
import { fetchMexcClosedPositions } from "./historyPositions.js";

export interface ClosedPositionsRequestBody {
  apiKey?: string;
  apiSecret?: string;
  startDate?: string;
}

export interface ClosedPositionsSuccess {
  positions: Awaited<ReturnType<typeof fetchMexcClosedPositions>>;
  importedCount: number;
}

export interface ClosedPositionsError {
  error: string;
}

function parseStartDateMs(startDate: string): number {
  const trimmed = startDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new MexcApiError("startDate must be yyyy-MM-dd");
  }
  const ms = Date.parse(`${trimmed}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) {
    throw new MexcApiError("Invalid startDate");
  }
  return ms;
}

export async function handleClosedPositionsRequest(
  body: ClosedPositionsRequestBody
): Promise<{
  status: number;
  payload: ClosedPositionsSuccess | ClosedPositionsError;
}> {
  const apiKey = body.apiKey?.trim();
  const apiSecret = body.apiSecret?.trim();
  const startDate = body.startDate?.trim();

  if (!apiKey || !apiSecret) {
    return {
      status: 400,
      payload: { error: "apiKey and apiSecret are required" },
    };
  }

  if (!startDate) {
    return {
      status: 400,
      payload: { error: "startDate is required (yyyy-MM-dd)" },
    };
  }

  try {
    const startTimeMs = parseStartDateMs(startDate);
    const positions = await fetchMexcClosedPositions(
      apiKey,
      apiSecret,
      startTimeMs
    );
    return {
      status: 200,
      payload: { positions, importedCount: positions.length },
    };
  } catch (err) {
    const message =
      err instanceof MexcApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to fetch MEXC closed positions";
    const status = err instanceof MexcApiError && err.status ? err.status : 502;
    return { status, payload: { error: message } };
  }
}

async function readJsonBody(req: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}

export async function handleClosedPositionsHttpRequest(
  method: string | undefined,
  bodyStream: NodeJS.ReadableStream
): Promise<{
  status: number;
  payload: ClosedPositionsSuccess | ClosedPositionsError;
}> {
  if (method !== "POST") {
    return { status: 405, payload: { error: "Method not allowed" } };
  }

  let body: ClosedPositionsRequestBody;
  try {
    body = (await readJsonBody(bodyStream)) as ClosedPositionsRequestBody;
  } catch {
    return { status: 400, payload: { error: "Invalid JSON body" } };
  }

  return handleClosedPositionsRequest(body);
}
