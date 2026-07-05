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
