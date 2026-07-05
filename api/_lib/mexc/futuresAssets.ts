import { createHmac } from "node:crypto";

const MEXC_FUTURES_BASE = "https://contract.mexc.com";

export class MexcApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "MexcApiError";
  }
}

export interface MexcAsset {
  currency: string;
  equity: string | number;
}

export interface MexcAssetsResponse {
  success?: boolean;
  code?: number;
  data?: MexcAsset[];
  message?: string;
}

export function signMexcFuturesRequest(
  accessKey: string,
  secretKey: string,
  requestParam = ""
): { timestamp: string; signature: string } {
  const timestamp = String(Date.now());
  const target = `${accessKey}${timestamp}${requestParam}`;
  const signature = createHmac("sha256", secretKey).update(target).digest("hex");
  return { timestamp, signature };
}

export function parseUsdtEquity(response: MexcAssetsResponse): number {
  if (response.success === false) {
    throw new MexcApiError(response.message ?? "MEXC request failed");
  }

  const assets = response.data;
  if (!Array.isArray(assets)) {
    throw new MexcApiError("Unexpected MEXC response format");
  }

  const usdt = assets.find(
    (a) => a.currency?.toUpperCase() === "USDT"
  );
  if (!usdt) {
    throw new MexcApiError("USDT asset not found in MEXC account");
  }

  const equity = Number(usdt.equity);
  if (!Number.isFinite(equity)) {
    throw new MexcApiError("Invalid USDT equity value from MEXC");
  }

  return equity;
}

export async function fetchMexcFuturesEquity(
  apiKey: string,
  apiSecret: string,
  fetchFn: typeof fetch = fetch
): Promise<number> {
  const trimmedKey = apiKey.trim();
  const trimmedSecret = apiSecret.trim();
  if (!trimmedKey || !trimmedSecret) {
    throw new MexcApiError("API key and secret are required");
  }

  const { timestamp, signature } = signMexcFuturesRequest(
    trimmedKey,
    trimmedSecret
  );

  const res = await fetchFn(
    `${MEXC_FUTURES_BASE}/api/v1/private/account/assets`,
    {
      method: "GET",
      headers: {
        ApiKey: trimmedKey,
        "Request-Time": timestamp,
        Signature: signature,
        "Content-Type": "application/json",
      },
    }
  );

  let body: MexcAssetsResponse;
  try {
    body = (await res.json()) as MexcAssetsResponse;
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

  return parseUsdtEquity(body);
}
