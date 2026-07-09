import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildMexcGetRequestParam, signMexcFuturesRequest } from "./signing";

describe("buildMexcGetRequestParam", () => {
  it("sorts keys alphabetically and joins with &", () => {
    const param = buildMexcGetRequestParam({
      page_num: 1,
      page_size: 100,
      start_time: 1751328000000,
    });
    expect(param).toBe("page_num=1&page_size=100&start_time=1751328000000");
  });

  it("omits empty values", () => {
    const param = buildMexcGetRequestParam({
      page_num: 1,
      symbol: "",
    });
    expect(param).toBe("page_num=1");
  });
});

describe("signMexcFuturesRequest", () => {
  it("produces a hex signature", () => {
    const { signature } = signMexcFuturesRequest("test-key", "test-secret");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("matches HMAC-SHA256 of accessKey + timestamp + paramString", () => {
    const accessKey = "test-key";
    const secret = "test-secret";
    const requestParam = "page_num=1&page_size=100";
    const { timestamp, signature } = signMexcFuturesRequest(
      accessKey,
      secret,
      requestParam
    );
    const expected = createHmac("sha256", secret)
      .update(`${accessKey}${timestamp}${requestParam}`)
      .digest("hex");
    expect(signature).toBe(expected);
  });
});
