/**
 * Vẽ MỘT khung hình 2D của một cảnh lên canvas — dùng cho xuất bản
 * (và là bản tham chiếu của logic vẽ trong TimelineEditor): camera áp
 * trước, layer theo transform nội suy (keyframe + chuyển động tham số),
 * phụ đề ở đáy khung theo dòng thoại hiệu lực. Deterministic theo t:
 * cùng cảnh + cùng thời điểm → cùng khung hình, phát thử hay xuất bản.
 */

import type { AnimScene } from "./animProject";
import { sampleCamera, sampleLayerTransform } from "./timeline";
import { dialogueLineAt } from "./dialogue";

export function drawSceneFrame(
  ctx: CanvasRenderingContext2D,
  scene: AnimScene,
  t: number,
  width: number,
  height: number,
  getImage: (dataUrl: string) => HTMLImageElement | null,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0a0616";
  ctx.fillRect(0, 0, width, height);
  const timeline = scene.timeline;
  if (!timeline) return;
  const cam = sampleCamera(timeline.cameraKeys, t);

  for (const layer of timeline.layers) {
    if (!layer.visible) continue;
    const tr = sampleLayerTransform(layer, t);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x * width, -cam.y * height);
    ctx.translate(tr.x * width, tr.y * height);
    ctx.rotate((tr.rotation * Math.PI) / 180);
    ctx.scale(tr.scale, tr.scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, tr.opacity));
    const img = layer.imageDataUrl ? getImage(layer.imageDataUrl) : null;
    if (img && img.complete && img.naturalWidth > 0) {
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = layer.color;
      const w = width * 0.62;
      const h = height * 0.62;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 18);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `600 ${Math.round(height * 0.041)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(layer.name, 0, 8);
    }
    ctx.restore();
  }

  const line = dialogueLineAt(scene.dialogue ?? [], t);
  if (line && line.text.trim()) {
    ctx.save();
    ctx.font = `600 ${Math.round(height * 0.046)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.fillStyle = "#ffffff";
    const label = line.speaker ? `${line.speaker}: ${line.text}` : line.text;
    ctx.strokeText(label, width / 2, height - height * 0.052);
    ctx.fillText(label, width / 2, height - height * 0.052);
    ctx.restore();
  }
}
