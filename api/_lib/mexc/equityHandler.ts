import { fetchMexcFuturesEquity, MexcApiError } from "./futuresAssets.js";

export interface FuturesEquityRequestBody {
  apiKey?: string;
  apiSecret?: string;
}

export interface FuturesEquitySuccess {
  equity: number;
}

export interface FuturesEquityError {
  error: string;
}

export async function handleFuturesEquityRequest(
  body: FuturesEquityRequestBody
): Promise<{ status: number; payload: FuturesEquitySuccess | FuturesEquityError }> {
  const apiKey = body.apiKey?.trim();
  const apiSecret = body.apiSecret?.trim();

  if (!apiKey || !apiSecret) {
    return {
      status: 400,
      payload: { error: "apiKey and apiSecret are required" },
    };
  }

  try {
    const equity = await fetchMexcFuturesEquity(apiKey, apiSecret);
    return { status: 200, payload: { equity } };
  } catch (err) {
    const message =
      err instanceof MexcApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to fetch MEXC balance";
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

export async function handleFuturesEquityHttpRequest(
  method: string | undefined,
  bodyStream: NodeJS.ReadableStream
): Promise<{ status: number; payload: FuturesEquitySuccess | FuturesEquityError }> {
  if (method !== "POST") {
    return { status: 405, payload: { error: "Method not allowed" } };
  }

  let body: FuturesEquityRequestBody;
  try {
    body = (await readJsonBody(bodyStream)) as FuturesEquityRequestBody;
  } catch {
    return { status: 400, payload: { error: "Invalid JSON body" } };
  }

  return handleFuturesEquityRequest(body);
}
