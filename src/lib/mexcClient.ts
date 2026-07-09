import type { MexcClosedPositionDto } from "../types";

export class MexcClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MexcClientError";
  }
}

export async function fetchMexcFuturesEquity(
  apiKey: string,
  apiSecret: string
): Promise<number> {
  const res = await fetch("/api/mexc/futures-equity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, apiSecret }),
  });

  let body: { equity?: number; error?: string };
  try {
    body = (await res.json()) as { equity?: number; error?: string };
  } catch {
    throw new MexcClientError(`Request failed (${res.status})`);
  }

  if (!res.ok || body.error) {
    throw new MexcClientError(body.error ?? `Request failed (${res.status})`);
  }

  if (body.equity == null || !Number.isFinite(body.equity)) {
    throw new MexcClientError("Invalid equity in response");
  }

  return body.equity;
}

export async function fetchMexcClosedPositions(
  apiKey: string,
  apiSecret: string,
  startDate: string
): Promise<MexcClosedPositionDto[]> {
  const res = await fetch("/api/mexc/futures-closed-positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, apiSecret, startDate }),
  });

  let body: {
    positions?: MexcClosedPositionDto[];
    importedCount?: number;
    error?: string;
  };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new MexcClientError(`Request failed (${res.status})`);
  }

  if (!res.ok || body.error) {
    throw new MexcClientError(body.error ?? `Request failed (${res.status})`);
  }

  if (!Array.isArray(body.positions)) {
    throw new MexcClientError("Invalid positions in response");
  }

  return body.positions;
}
