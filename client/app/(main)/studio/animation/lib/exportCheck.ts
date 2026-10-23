/**
 * Kiểm tra trước xuất bản — luật cứng thuần (không AI): quét dự án tìm
 * các vấn đề khiến bản xuất bị hỏng/thiếu: cảnh trống, cảnh chưa có hình,
 * thoại tràn khỏi cảnh, cảnh 3D chưa dựng vật thể. Chạy ngay trong trình
 * duyệt trước khi render để người dùng sửa lúc còn rẻ.
 */

import { projectDurationSec, type AnimProject } from "./animProject";

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
      if ((scene.previz?.cameraKeys.length ?? 0) === 0) {
        issues.push({
          ...at,
          level: "warn",
          message: `Cảnh "${scene.name}" chưa có key camera — sẽ dùng camera mặc định.`,
        });
      }
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
