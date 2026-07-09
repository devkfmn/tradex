import { createHmac } from "node:crypto";

export function buildMexcGetRequestParam(
  params: Record<string, string | number | undefined>
): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
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
