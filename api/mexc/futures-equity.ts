import { handleFuturesEquityHttpRequest } from "../../src/server/mexc/equityHandler";

type VercelRequest = {
  method?: string;
  on(event: "data", listener: (chunk: Buffer | string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { status, payload } = await handleFuturesEquityHttpRequest(
    req.method,
    req
  );
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(payload);
}
