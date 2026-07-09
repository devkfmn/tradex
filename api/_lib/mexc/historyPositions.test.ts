import { describe, expect, it, vi } from "vitest";
import {
  fetchMexcClosedPositions,
  isClosedMexcPosition,
  mapMexcPositionToDto,
  mexcPositionTypeToDirection,
  mexcSymbolToCoin,
  type MexcHistoryPosition,
} from "./historyPositions";

describe("mexcSymbolToCoin", () => {
  it("extracts base asset from contract symbol", () => {
    expect(mexcSymbolToCoin("BTC_USDT")).toBe("BTC");
    expect(mexcSymbolToCoin("eth_usdt")).toBe("ETH");
  });
});

describe("mexcPositionTypeToDirection", () => {
  it("maps position type to direction", () => {
    expect(mexcPositionTypeToDirection(1)).toBe("Long");
    expect(mexcPositionTypeToDirection(2)).toBe("Short");
  });
});

describe("isClosedMexcPosition", () => {
  it("detects closed positions", () => {
    expect(isClosedMexcPosition({ positionShowStatus: "CLOSED" } as MexcHistoryPosition)).toBe(
      true
    );
    expect(isClosedMexcPosition({ state: 3 } as MexcHistoryPosition)).toBe(true);
    expect(isClosedMexcPosition({ state: 1 } as MexcHistoryPosition)).toBe(false);
  });
});

describe("mapMexcPositionToDto", () => {
  it("maps MEXC position fields to tradex DTO", () => {
    const dto = mapMexcPositionToDto({
      positionId: 12345,
      symbol: "BTC_USDT",
      positionType: 1,
      newOpenAvgPrice: 100000,
      newCloseAvgPrice: 101000,
      realised: 50.5,
      leverage: 10,
      fee: -0.5,
      holdFee: 0.1,
      updateTime: Date.parse("2025-06-15T12:00:00.000Z"),
    });

    expect(dto.mexcPositionId).toBe("12345");
    expect(dto.coin).toBe("BTC");
    expect(dto.direction).toBe("Long");
    expect(dto.entry).toBe(100000);
    expect(dto.closePrice).toBe(101000);
    expect(dto.pnl).toBe(50.5);
    expect(dto.date).toBe("2025-06-15");
    expect(dto.leverage).toBe(10);
    expect(dto.postNotes).toContain("Imported from MEXC futures");
  });
});

describe("fetchMexcClosedPositions", () => {
  it("paginates through all pages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            resultList: [
              {
                positionId: 1,
                symbol: "BTC_USDT",
                positionType: 1,
                state: 3,
                newOpenAvgPrice: 100,
                newCloseAvgPrice: 110,
                realised: 10,
                updateTime: Date.now(),
              },
            ],
            totalPage: 2,
            currentPage: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            resultList: [
              {
                positionId: 2,
                symbol: "ETH_USDT",
                positionType: 2,
                state: 3,
                newOpenAvgPrice: 200,
                newCloseAvgPrice: 190,
                realised: -5,
                updateTime: Date.now(),
              },
            ],
            totalPage: 2,
            currentPage: 2,
          },
        }),
      });

    const positions = await fetchMexcClosedPositions(
      "key",
      "secret",
      0,
      Date.now(),
      fetchMock as typeof fetch
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(positions).toHaveLength(2);
    expect(positions[0]?.coin).toBe("BTC");
    expect(positions[1]?.coin).toBe("ETH");
  });
});
