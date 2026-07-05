import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MexcApiError, parseUsdtEquity, signMexcFuturesRequest } from "./futuresAssets";

describe("signMexcFuturesRequest", () => {
  it("produces a hex signature", () => {
    const { signature } = signMexcFuturesRequest("test-key", "test-secret");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("matches HMAC-SHA256 of accessKey + timestamp + paramString", () => {
    const accessKey = "test-key";
    const secret = "test-secret";
    const { timestamp, signature } = signMexcFuturesRequest(accessKey, secret);
    const expected = createHmac("sha256", secret)
      .update(`${accessKey}${timestamp}`)
      .digest("hex");
    expect(signature).toBe(expected);
  });
});

describe("parseUsdtEquity", () => {
  it("returns USDT equity from valid response", () => {
    const equity = parseUsdtEquity({
      success: true,
      data: [
        { currency: "BTC", equity: "0.5" },
        { currency: "USDT", equity: "1234.56" },
      ],
    });
    expect(equity).toBe(1234.56);
  });

  it("throws when USDT asset is missing", () => {
    expect(() =>
      parseUsdtEquity({
        success: true,
        data: [{ currency: "BTC", equity: "1" }],
      })
    ).toThrow(MexcApiError);
  });

  it("throws when success is false", () => {
    expect(() =>
      parseUsdtEquity({
        success: false,
        message: "Invalid signature",
      })
    ).toThrow("Invalid signature");
  });

  it("throws on invalid equity value", () => {
    expect(() =>
      parseUsdtEquity({
        success: true,
        data: [{ currency: "USDT", equity: "not-a-number" }],
      })
    ).toThrow(MexcApiError);
  });
});
