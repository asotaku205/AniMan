import { describe, expect, it } from "vitest";
import { blitSelectionMask, type BlitContext } from "../lib/selectionBlit";

/**
 * Context giả: ghi lại thứ tự thao tác kèm `globalCompositeOperation` tại thời
 * điểm gọi. Đây là thứ dễ sai nhất của phép chép vùng chọn (xem `selectionBlit`).
 */
function fakeContext() {
  const calls: string[] = [];
  const ctx = {
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    globalAlpha: 1,
    filter: "none",
    fillStyle: "#000000",
    drawImage() {
      calls.push(`drawImage@${ctx.globalCompositeOperation}`);
    },
    fill() {
      calls.push(`fill@${ctx.globalCompositeOperation}`);
    },
  };
  return { ctx: ctx as unknown as BlitContext, calls };
}

describe("blitSelectionMask", () => {
  it("vẽ nguồn trước rồi mới mặt nạ bằng destination-in", () => {
    const { ctx, calls } = fakeContext();

    blitSelectionMask(
      ctx,
      {} as CanvasImageSource,
      {} as Path2D,
      "nonzero",
    );

    // Thứ tự này quyết định kết quả là **màu của nguồn** (nét vẽ) chứ không
    // phải màu trắng của mặt nạ (bug "tờ giấy bị rách").
    expect(calls).toEqual(["drawImage@source-over", "fill@destination-in"]);
  });

  it("lấy màu từ nguồn nên mặt nạ vẫn là trắng", () => {
    const { ctx, calls } = fakeContext();

    blitSelectionMask(ctx, {} as CanvasImageSource, {} as Path2D, "nonzero");

    // `destination-in` giữ màu **đích** → đích phải là nguồn, mặt nạ chỉ đóng
    // vai nguồn alpha. Nếu đảo lại, nét vẽ thành bóng trắng, vô hình trên giấy.
    expect(ctx.fillStyle).toBe("#ffffff");
    expect(calls[0].startsWith("drawImage")).toBe(true);
    expect(calls[1]).toContain("destination-in");
  });

  it("trả context về trạng thái vẽ thường sau khi chép", () => {
    const { ctx } = fakeContext();

    blitSelectionMask(ctx, {} as CanvasImageSource, {} as Path2D, "evenodd");

    expect(ctx.globalCompositeOperation).toBe("source-over");
    expect(ctx.globalAlpha).toBe(1);
    expect(ctx.filter).toBe("none");
  });
});
