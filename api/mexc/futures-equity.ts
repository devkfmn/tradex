import {
  handleFuturesEquityRequest,
  type FuturesEquityRequestBody,
} from "../_lib/mexc/equityHandler";

type VercelRequest = {
  method?: string;
  body?: FuturesEquityRequestBody;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { status, payload } = await handleFuturesEquityRequest(req.body ?? {});
    return res.status(status).json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return res.status(500).json({ error: message });
  }
}
