/**
 * Cài đặt hậu kỳ của một cảnh 3D (giai đoạn C): phát sáng, mờ hậu cảnh,
 * dư ảnh chuyển động — áp trong vòng render của trình dựng cảnh 3D.
 * Tất cả mặc định TẮT để cảnh cũ nhìn y như trước.
 */

export interface BloomSettings {
  enabled: boolean;
  /** Ngưỡng sáng mới phát sáng (0..1). */
  threshold: number;
  /** Cường độ phát sáng (0..3). */
  strength: number;
  /** Độ lan của quầng sáng (0..1). */
  radius: number;
  /** Độ phân giải xử lý: đủ (nặng) hay một nửa (nhẹ, máy yếu). */
  quality: "full" | "half";
}

export interface DofSettings {
  enabled: boolean;
  /** Khoảng cách điểm nét (mét, dọc hướng nhìn của camera). */
  focus: number;
  /** Độ mở ống kính (0..0.1) — càng lớn càng mờ hậu cảnh. */
  aperture: number;
  /** Độ mờ tối đa (0..0.05). */
  maxblur: number;
}

export interface AfterimageSettings {
  enabled: boolean;
  /** Độ giữ khung cũ (0..1) — càng cao vệt dư càng dài. */
  damp: number;
}

export interface ScenePostSettings {
  bloom: BloomSettings;
  dof: DofSettings;
  afterimage: AfterimageSettings;
}

export const DEFAULT_SCENE_POST: ScenePostSettings = {
  bloom: { enabled: false, threshold: 0.85, strength: 0.7, radius: 0.4, quality: "full" },
  dof: { enabled: false, focus: 8, aperture: 0.025, maxblur: 0.01 },
  afterimage: { enabled: false, damp: 0.9 },
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/** Kẹp mọi tham số hậu kỳ về khoảng hợp lệ (số lạ từ dữ liệu cũ không phá hình). */
export function clampScenePostSettings(p: ScenePostSettings): ScenePostSettings {
  return {
    bloom: {
      enabled: !!p.bloom?.enabled,
      threshold: clamp(p.bloom?.threshold ?? 0.85, 0, 1),
      strength: clamp(p.bloom?.strength ?? 0.7, 0, 3),
      radius: clamp(p.bloom?.radius ?? 0.4, 0, 1),
      quality: p.bloom?.quality === "half" ? "half" : "full",
    },
    dof: {
      enabled: !!p.dof?.enabled,
      focus: clamp(p.dof?.focus ?? 8, 0.1, 100),
      aperture: clamp(p.dof?.aperture ?? 0.025, 0, 0.1),
      maxblur: clamp(p.dof?.maxblur ?? 0.01, 0, 0.05),
    },
    afterimage: {
      enabled: !!p.afterimage?.enabled,
      damp: clamp(p.afterimage?.damp ?? 0.9, 0, 1),
    },
  };
}

/** Cài đặt hậu kỳ hiệu lực của cảnh (cảnh cũ chưa có thì dùng mặc định). */
export function scenePostOf(
  scene: { scenePost?: ScenePostSettings } | null | undefined,
): ScenePostSettings {
  return scene?.scenePost
    ? clampScenePostSettings(scene.scenePost)
    : DEFAULT_SCENE_POST;
}
