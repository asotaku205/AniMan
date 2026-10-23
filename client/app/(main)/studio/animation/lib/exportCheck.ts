/**
 * Kiểm tra trước xuất bản — luật cứng thuần (không AI): quét dự án tìm
 * các vấn đề khiến bản xuất bị hỏng/thiếu: cảnh trống, cảnh chưa có hình,
 * thoại tràn khỏi cảnh, cảnh 3D chưa dựng vật thể, dòng thoại chưa có bản
 * thu giọng (Slice B4). Chạy ngay trong trình duyệt trước khi render để
 * người dùng sửa lúc còn rẻ.
 */

import { projectDurationSec, type AnimProject } from "./animProject";
import { selectedDialogueTake } from "./dialogue";
import { samplePrevizCamera, samplePrevizObject } from "./previz";

export type ExportIssueLevel = "error" | "warn";

export interface ExportIssue {
  level: ExportIssueLevel;
  message: string;
  sceneId?: string;
  sceneName?: string;
}

export function checkProjectForExport(project: AnimProject): ExportIssue[] {
  const issues: ExportIssue[] = [];

  if (project.scenes.length === 0) {
    issues.push({
      level: "error",
      message: "Dự án chưa có cảnh nào — thêm cảnh ở bảng phân cảnh trước khi xuất.",
    });
    return issues;
  }
  if (projectDurationSec(project) < 2) {
    issues.push({
      level: "warn",
      message: "Tổng thời lượng phim dưới 2 giây — có thể quá ngắn để xem.",
    });
  }

  for (const scene of project.scenes) {
    const at = { sceneId: scene.id, sceneName: scene.name };
    if (scene.durationSec < 1) {
      issues.push({
        ...at,
        level: "warn",
        message: `Cảnh "${scene.name}" ngắn hơn 1 giây — khán giả khó kịp nhìn.`,
      });
    }
    if (project.kind === "2d") {
      const layers = scene.timeline?.layers ?? [];
      const visible = layers.filter((l) => l.visible);
      if (visible.length === 0) {
        issues.push({
          ...at,
          level: "error",
          message: `Cảnh "${scene.name}" chưa có layer hiển thị nào — bản xuất sẽ đen khung.`,
        });
      } else if (visible.every((l) => !l.imageDataUrl)) {
        issues.push({
          ...at,
          level: "warn",
          message: `Cảnh "${scene.name}" mới có thẻ màu, chưa có hình thật (nạp panel manga hoặc tải ảnh lên layer).`,
        });
      }
    } else {
      const objects = scene.previz?.objects ?? [];
      if (objects.length === 0) {
        issues.push({
          ...at,
          level: "error",
          message: `Cảnh "${scene.name}" chưa dựng vật thể 3D nào.`,
        });
      }
      // Kiểm tra không gian (học từ quy trình dựng cảnh 3D của topview):
      // vật thể dưới mặt đất/lơ lửng và camera quay vào khung trống.
      const previz = scene.previz;
      if (previz && previz.objects.length > 0) {
        for (const obj of previz.objects) {
          const ys = obj.keys.map((k) => k.position.y);
          if (ys.length > 0 && Math.min(...ys) < -0.05) {
            issues.push({
              ...at,
              level: "warn",
              message: `Cảnh "${scene.name}": vật thể "${obj.name}" có vị trí nằm dưới mặt đất.`,
            });
          } else if (
            obj.kind !== "wall" &&
            ys.length > 0 &&
            Math.min(...ys) > 0.6
          ) {
            issues.push({
              ...at,
              level: "warn",
              message: `Cảnh "${scene.name}": vật thể "${obj.name}" có vẻ đang lơ lửng trên không (mọi vị trí đều cao hơn mặt đất 0,6m).`,
            });
          }
        }
        const cam = samplePrevizCamera(previz.cameraKeys, 0);
        const anyInFrame = previz.objects.some((obj) => {
          const pos = samplePrevizObject(obj, 0).position;
          const toObj = {
            x: pos.x - cam.position.x,
            y: pos.y - cam.position.y,
            z: pos.z - cam.position.z,
          };
          const toTarget = {
            x: cam.target.x - cam.position.x,
            y: cam.target.y - cam.position.y,
            z: cam.target.z - cam.position.z,
          };
          const dot =
            toObj.x * toTarget.x + toObj.y * toTarget.y + toObj.z * toTarget.z;
          const lenA = Math.hypot(toObj.x, toObj.y, toObj.z);
          const lenB = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
          if (lenA === 0 || lenB === 0) return true;
          // cos góc < ~35° coi như vật thể nằm trong khung hình
          return dot / (lenA * lenB) > 0.82;
        });
        if (!anyInFrame) {
          issues.push({
            ...at,
            level: "warn",
            message: `Cảnh "${scene.name}": camera dường như không hướng vào vật thể nào — khung hình có thể trống.`,
          });
        }
      }
      if ((scene.previz?.cameraKeys.length ?? 0) === 0) {
        issues.push({
          ...at,
          level: "warn",
          message: `Cảnh "${scene.name}" chưa có key camera — sẽ dùng camera mặc định.`,
        });
      }
    }
    const missingVoice = (scene.dialogue ?? []).filter(
      (l) => l.text.trim() && !selectedDialogueTake(l),
    ).length;
    if (missingVoice > 0) {
      issues.push({
        ...at,
        level: "warn",
        message: `Cảnh "${scene.name}" có ${missingVoice} dòng thoại chưa có bản thu giọng — bản xuất ở các dòng đó sẽ chỉ hiện phụ đề, không có tiếng.`,
      });
    }
    for (const line of scene.dialogue ?? []) {
      const end = line.startSec + line.durationSec;
      if (end > scene.durationSec + 0.01) {
        issues.push({
          ...at,
          level: "warn",
          message: `Cảnh "${scene.name}": dòng thoại "${line.text.slice(0, 24)}…" kết thúc ở ${end.toFixed(1)}s, vượt thời lượng cảnh ${scene.durationSec.toFixed(1)}s.`,
        });
      }
      if (!line.text.trim()) {
        issues.push({
          ...at,
          level: "warn",
          message: `Cảnh "${scene.name}" có dòng thoại trống.`,
        });
      }
    }
  }
  return issues;
}

export function hasExportErrors(issues: ExportIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}
