/**
 * selectionBlit — chép pixel của một canvas **chỉ trong đường bao vùng chọn**
 * (BR-T05, AC-T3.1/T3.3). Tách khỏi hook để phần dễ sai nhất (thứ tự tô mặt nạ
 * + luật Porter-Duff) có test riêng, không cần trình duyệt.
 *
 * ⚠️ Thứ tự bắt buộc: **vẽ nguồn trước, rồi mới "destination-in" bằng mặt nạ**.
 * `destination-in` giữ **màu của đích** (chỉ lấy alpha của nguồn), nên nếu tô
 * mặt nạ trắng trước rồi mới vẽ nguồn vào thì kết quả là một bóng **trắng** đúng
 * hình nét vẽ: trên giấy trắng nó vô hình, trông như tờ giấy bị rách.
 */

/** Phần API canvas mà phép chép vùng chọn cần (đủ để test bằng đối tượng giả). */
export interface BlitContext {
  globalCompositeOperation: GlobalCompositeOperation;
  globalAlpha: number;
  filter: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
  fill(path: Path2D, fillRule?: CanvasFillRule): void;
}

/**
 * Chép **màu thật** của `source` vào `dst`, giới hạn trong `path` (mặt nạ đặc).
 *
 * @param dst    context đích (canvas đệm vùng chọn / clipboard)
 * @param source canvas nguồn (bitmap layer đang chọn)
 * @param path   đường bao vùng chọn, cùng hệ toạ độ với `source`
 * @param rule   luật tô: `nonzero` thường, `evenodd` khi vùng chọn đã đảo
 */
export function blitSelectionMask(
  dst: BlitContext,
  source: CanvasImageSource,
  path: Path2D,
  rule: CanvasFillRule,
): void {
  dst.globalCompositeOperation = "source-over";
  dst.globalAlpha = 1;
  dst.filter = "none";
  dst.drawImage(source, 0, 0);

  dst.globalCompositeOperation = "destination-in";
  dst.fillStyle = "#ffffff";
  dst.fill(path, rule);
  dst.globalCompositeOperation = "source-over";
}
