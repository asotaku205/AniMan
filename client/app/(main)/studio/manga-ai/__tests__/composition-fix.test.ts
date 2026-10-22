import { describe, expect, it } from "vitest";
import { describeFix } from "../lib/compositionFix";

describe("describeFix — diễn giải phép chỉnh bố cục (Slice 4)", () => {
  it("dời + thu nhỏ đọc thành câu tiếng Việt có phần trăm", () => {
    expect(describeFix({ dx: 0.08, dy: -0.04, scale: 0.9 })).toBe(
      "dời sang phải 8% · dời lên 4% · thu nhỏ 10%",
    );
  });

  it("dời trái/xuống và phóng to", () => {
    expect(describeFix({ dx: -0.15, dy: 0.2, scale: 1.25 })).toBe(
      "dời sang trái 15% · dời xuống 20% · phóng to 25%",
    );
  });

  it("chỉ phóng to, không dời", () => {
    expect(describeFix({ dx: 0, dy: 0, scale: 2 })).toBe("phóng to 100%");
  });

  it("số lẻ dưới ngưỡng coi như giữ nguyên", () => {
    expect(describeFix({ dx: 0.002, dy: -0.001, scale: 1.003 })).toBe(
      "giữ nguyên vị trí và kích thước",
    );
  });
});
