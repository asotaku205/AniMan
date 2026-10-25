import { describe, expect, it } from "vitest";
import {
  TRANSITION_SEC,
  creditRollDuration,
  creditRollOffset,
  drawCreditRoll,
  drawLowerThird,
  drawTitleCard,
  drawTransitionOverlay,
  irisRadius,
  lowerThirdState,
  transitionCover,
  wipeRect,
  zoomTransform,
  type LowerThird,
  type PostSettings,
} from "../lib/postFx";
import { DEFAULT_POST } from "../lib/postFx";
import {
  DEFAULT_SCENE_POST,
  clampScenePostSettings,
} from "../lib/scenePost";
import {
  createAnimProject,
  createAnimScene,
  projectWallDurationSec,
  sceneSpeed,
  sceneWallDurationSec,
} from "../lib/animProject";
import {
  contentTimeInSegment,
  filmTimeline,
  previewTimeline,
  segmentAtWallTime,
} from "../lib/animatic";
import { buildFilmAudioPlan } from "../lib/filmAudio";
import { buildDialogueTrack, addDialogueTake } from "../lib/dialogue";
import { EFFECT_PRESETS } from "../lib/effectPresets";

const W = 960;
const H = 540;

/** Bản ghi tối thiểu của CanvasRenderingContext2D để kiểm tra lệnh vẽ. */
function mockCtx() {
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  const ctx: Record<string, unknown> = {
    calls,
    save: () => calls.push({ fn: "save", args: [] }),
    restore: () => calls.push({ fn: "restore", args: [] }),
    beginPath: () => calls.push({ fn: "beginPath", args: [] }),
    rect: (x: number, y: number, w: number, h: number) =>
      calls.push({ fn: "rect", args: [x, y, w, h] }),
    arc: (x: number, y: number, r: number) =>
      calls.push({ fn: "arc", args: [x, y, r] }),
    clip: (rule?: string) => calls.push({ fn: "clip", args: [rule] }),
    drawImage: (...args: unknown[]) =>
      calls.push({ fn: "drawImage", args }),
    fillRect: (...args: unknown[]) =>
      calls.push({ fn: "fillRect", args }),
    fillText: (text: string, x: number, y: number) =>
      calls.push({ fn: "fillText", args: [text, x, y] }),
    translate: (x: number, y: number) =>
      calls.push({ fn: "translate", args: [x, y] }),
    scale: (x: number, y: number) =>
      calls.push({ fn: "scale", args: [x, y] }),
    createLinearGradient: () => ({
      addColorStop: () => undefined,
    }),
    measureText: () => ({ width: 100 }),
  };
  return ctx as unknown as CanvasRenderingContext2D & {
    calls: typeof calls;
  };
}

function fillTexts(ctx: CanvasRenderingContext2D & { calls: Array<{ fn: string; args: unknown[] }> }) {
  return ctx.calls.filter((c) => c.fn === "fillText");
}

describe("chuyển cảnh mới (giai đoạn C)", () => {
  const post = (t: PostSettings["transition"]): PostSettings => ({
    ...DEFAULT_POST,
    transition: t,
  });

  it("transitionCover: không chuyển cảnh / cảnh đầu = 0; giảm dần 1 → 0 trong cửa sổ", () => {
    expect(transitionCover(0, 1, post("none"))).toBe(0);
    expect(transitionCover(0, 0, post("wipe-left"))).toBe(0);
    expect(transitionCover(0, 1, post("wipe-left"))).toBe(1);
    expect(transitionCover(TRANSITION_SEC / 2, 1, post("wipe-left"))).toBeCloseTo(0.5);
    expect(transitionCover(TRANSITION_SEC, 1, post("wipe-left"))).toBe(0);
    expect(transitionCover(99, 1, post("iris-close"))).toBe(0);
    expect(transitionCover(0, 1, post("fade"))).toBe(0); // fade dùng màn đen, không phủ khung cũ
  });

  it("wipeRect: đủ khung lúc đầu, rỗng lúc cuối, đúng phía ở giữa", () => {
    expect(wipeRect(1, "wipe-left", W, H)).toEqual({ x: 0, y: 0, w: W, h: H });
    expect(wipeRect(0, "wipe-left", W, H).w).toBe(0);
    expect(wipeRect(0.5, "wipe-left", W, H)).toEqual({ x: 0, y: 0, w: W / 2, h: H });
    expect(wipeRect(0.5, "wipe-right", W, H)).toEqual({ x: W / 2, y: 0, w: W / 2, h: H });
    expect(wipeRect(0.5, "wipe-up", W, H)).toEqual({ x: 0, y: 0, w: W, h: H / 2 });
    expect(wipeRect(0.5, "wipe-down", W, H)).toEqual({ x: 0, y: H / 2, w: W, h: H / 2 });
  });

  it("irisRadius: phủ đủ khung lúc đầu, co về 0 lúc cuối", () => {
    const max = Math.hypot(W, H) / 2;
    expect(irisRadius(1, W, H)).toBeCloseTo(max);
    expect(irisRadius(0, W, H)).toBe(0);
    expect(irisRadius(0.5, W, H)).toBeCloseTo(max / 2);
  });

  it("zoomTransform: lúc đầu nguyên khung, lúc cuối phóng to + mờ hẳn", () => {
    expect(zoomTransform(1)).toEqual({ scale: 1, alpha: 1 });
    expect(zoomTransform(0)).toEqual({ scale: 1.6, alpha: 0 });
    expect(zoomTransform(0.5)).toEqual({ scale: 1.3, alpha: 0.5 });
  });

  it("drawTransitionOverlay: wipe cắt đúng vùng, iris cắt đúng hình, zoom đổi alpha/scale, hoà tan trả false", () => {
    const prev = {} as unknown as HTMLCanvasElement;
    const ctx1 = mockCtx();
    expect(drawTransitionOverlay(ctx1, prev, W, H, "wipe-left", 0.5)).toBe(true);
    const rect = ctx1.calls.find((c) => c.fn === "rect");
    expect(rect?.args).toEqual([0, 0, W / 2, H]);
    expect(ctx1.calls.some((c) => c.fn === "drawImage")).toBe(true);

    const ctx2 = mockCtx();
    drawTransitionOverlay(ctx2, prev, W, H, "iris-close", 0.5);
    const arc = ctx2.calls.find((c) => c.fn === "arc");
    expect(arc?.args[2]).toBeCloseTo(Math.hypot(W, H) / 4);

    const ctx3 = mockCtx();
    drawTransitionOverlay(ctx3, prev, W, H, "iris-open", 0.5);
    expect(ctx3.calls.some((c) => c.fn === "clip" && c.args[0] === "evenodd")).toBe(true);

    const ctx4 = mockCtx();
    drawTransitionOverlay(ctx4, prev, W, H, "zoom", 0.5);
    expect((ctx4 as unknown as { globalAlpha: number }).globalAlpha).toBeCloseTo(0.5);
    expect(ctx4.calls.some((c) => c.fn === "scale" && c.args[0] === 1.3)).toBe(true);

    const ctx5 = mockCtx();
    expect(drawTransitionOverlay(ctx5, prev, W, H, "crossfade", 0.5)).toBe(false);
    expect(drawTransitionOverlay(ctx5, null, W, H, "wipe-left", 0.5)).toBe(false);
  });
});

describe("màn hình tiêu đề nâng cấp", () => {
  it("mặc định giữ nguyên bố cục cũ; vị trí trên/dưới dời chữ; cỡ chữ nhân theo hệ số", () => {
    const base = mockCtx();
    drawTitleCard(base, W, H, "Phim", "Phụ đề");
    const baseTitle = fillTexts(base).find((c) => c.args[0] === "Phim");
    expect(baseTitle?.args[2]).toBe(H / 2 - 18);

    const top = mockCtx();
    drawTitleCard(top, W, H, "Phim", "Phụ đề", { position: "top" });
    const topTitle = fillTexts(top).find((c) => c.args[0] === "Phim");
    expect((topTitle?.args[2] as number) ?? 0).toBeLessThan(H / 2 - 18);

    const bottom = mockCtx();
    drawTitleCard(bottom, W, H, "Phim", "Phụ đề", { position: "bottom" });
    const bottomTitle = fillTexts(bottom).find((c) => c.args[0] === "Phim");
    expect((bottomTitle?.args[2] as number) ?? 0).toBeGreaterThan(H / 2 - 18);

    const big = mockCtx();
    drawTitleCard(big, W, H, "Phim", "Phụ đề", { sizeScale: 2 });
    const baseFont = (base as unknown as { font: string }).font;
    const bigFont = (big as unknown as { font: string }).font;
    const sizeOf = (f: string) => Number(/(\d+)px/.exec(f)?.[1] ?? 0);
    expect(sizeOf(bigFont)).toBeGreaterThan(sizeOf(baseFont));
  });
});

describe("chữ chạy dưới + credit roll", () => {
  const lt: LowerThird = {
    name: "An",
    role: "Đạo diễn",
    position: "bottom-left",
    startSec: 1,
    durationSec: 4,
  };

  it("lowerThirdState: ngoài khung giờ = null; vào/ra mờ dần 0.3s; giữa = hiện rõ", () => {
    expect(lowerThirdState(0.5, lt)).toBeNull();
    expect(lowerThirdState(5, lt)).toBeNull();
    expect(lowerThirdState(1.15, lt)?.alpha).toBeCloseTo(0.5);
    expect(lowerThirdState(3, lt)?.alpha).toBe(1);
    expect(lowerThirdState(3, lt)?.offsetX).toBe(0);
    expect(lowerThirdState(4.85, lt)?.alpha).toBeCloseTo(0.5);
    expect(lowerThirdState(1.15, lt)?.offsetY).toBeGreaterThan(0); // trượt từ dưới lên
  });

  it("drawLowerThird vẽ tên + chức danh; ngoài khung giờ không vẽ", () => {
    const ctx = mockCtx();
    expect(drawLowerThird(ctx, W, H, lt, 3)).toBe(true);
    const texts = fillTexts(ctx).map((c) => c.args[0]);
    expect(texts).toContain("An");
    expect(texts).toContain("Đạo diễn");
    const ctx2 = mockCtx();
    expect(drawLowerThird(ctx2, W, H, lt, 9)).toBe(false);
    expect(fillTexts(ctx2)).toHaveLength(0);
  });

  it("credit roll: thời lượng = (chiều cao + số dòng × cao dòng) / tốc độ; vị trí cuộn tuyến tính", () => {
    expect(creditRollDuration(10, 44, H, 60)).toBeCloseTo((H + 10 * 44) / 60);
    expect(creditRollOffset(2, 60)).toBe(120);
    const ctx = mockCtx();
    drawCreditRoll(ctx, W, H, ["Dòng 1", "Dòng 2"], 0, { speed: 60, lineHeight: 44 });
    const first = fillTexts(ctx)[0];
    expect(first?.args[2]).toBe(H); // dòng đầu bắt đầu ở mép dưới
    const ctx2 = mockCtx();
    drawCreditRoll(ctx2, W, H, ["Dòng 1", "Dòng 2"], H / 60, { speed: 60, lineHeight: 44 });
    const first2 = fillTexts(ctx2)[0];
    expect(first2?.args[2]).toBe(0); // sau H/speed giây thì dòng đầu lên tới mép trên
  });
});

describe("quay chậm theo cảnh", () => {
  it("sceneSpeed: mặc định 1, kẹp 0.25–2", () => {
    expect(sceneSpeed({} as never)).toBe(1);
    expect(sceneSpeed({ speed: 0.1 } as never)).toBe(0.25);
    expect(sceneSpeed({ speed: 5 } as never)).toBe(2);
    expect(sceneSpeed({ speed: 0.5 } as never)).toBe(0.5);
  });

  it("thời lượng chiếu = thời lượng nội dung / tốc độ", () => {
    const s = createAnimScene("A", 4);
    s.speed = 0.5;
    expect(sceneWallDurationSec(s)).toBe(8);
    const p = createAnimProject("P", "2d");
    const s2 = createAnimScene("B", 6);
    p.scenes = [s, s2];
    expect(projectWallDurationSec(p)).toBe(14);
  });

  it("filmTimeline: đoạn theo thời gian chiếu, đổi ra thời gian nội dung đúng", () => {
    const s1 = createAnimScene("A", 4);
    const s2 = createAnimScene("B", 6);
    s2.speed = 0.5;
    const segs = filmTimeline([s1, s2]);
    expect(segs[0]).toMatchObject({ startSec: 0, endSec: 4 });
    expect(segs[1]).toMatchObject({ startSec: 4, endSec: 16 });
    expect(contentTimeInSegment(segs[1], 10)).toBeCloseTo(3);
    expect(segmentAtWallTime(segs, 99)?.index).toBe(1);
  });

  it("previewTimeline: cộng cửa sổ tiêu đề đầu phim + credit cuối phim", () => {
    const s1 = createAnimScene("A", 4);
    const tl = previewTimeline(
      { scenes: [s1], post: { ...DEFAULT_POST, titleCard: true, creditsLines: ["A", "B"] } } as never,
    );
    expect(tl.titleSec).toBe(2.2);
    expect(tl.segments[0].startSec).toBeCloseTo(2.2);
    expect(tl.creditsSec).toBeGreaterThan(0);
    expect(tl.totalSec).toBeCloseTo(2.2 + 4 + tl.creditsSec);
  });

  it("buildFilmAudioPlan: mốc thoại theo thời gian chiếu + tốc độ phát theo cảnh", () => {
    const project = createAnimProject("Phim", "2d");
    const s1 = createAnimScene("Mở", 4);
    s1.speed = 0.5;
    const s2 = createAnimScene("Giữa", 6);
    const { lines } = buildDialogueTrack(["Câu một."]);
    const withVoice = addDialogueTake(lines[0], { id: "tk1", durationSec: 1.5, volume: 0.8, createdAt: 1 });
    withVoice.startSec = 1;
    s1.dialogue = [withVoice];
    const l3 = buildDialogueTrack(["Câu ba."]).lines[0];
    s2.dialogue = [addDialogueTake(l3, { id: "tk3", durationSec: 1, volume: 1, createdAt: 2 })];
    project.scenes = [s1, s2];
    const plan = buildFilmAudioPlan(project);
    expect(plan.totalSec).toBe(14); // 8 + 6
    expect(plan.clips[0].atSec).toBeCloseTo(2); // 1 / 0.5
    expect(plan.clips[0].playbackRate).toBeCloseTo(0.5);
    expect(plan.clips[1].atSec).toBeCloseTo(8 + l3.startSec);
    expect(plan.clips[1].playbackRate ?? 1).toBe(1);
  });
});

describe("cài đặt hậu kỳ cảnh (phát sáng / mờ hậu cảnh / dư ảnh)", () => {
  it("mặc định: tất cả tắt", () => {
    expect(DEFAULT_SCENE_POST.bloom.enabled).toBe(false);
    expect(DEFAULT_SCENE_POST.dof.enabled).toBe(false);
    expect(DEFAULT_SCENE_POST.afterimage.enabled).toBe(false);
  });

  it("clamp: ngưỡng/cường độ/lan tỏa/dư ảnh/độ mờ trong khoảng hợp lệ", () => {
    const clamped = clampScenePostSettings({
      ...DEFAULT_SCENE_POST,
      bloom: { enabled: true, threshold: 2, strength: 9, radius: -1, quality: "half" },
      dof: { enabled: true, focus: 0, aperture: 1, maxblur: 9 },
      afterimage: { enabled: true, damp: 2 },
    });
    expect(clamped.bloom.threshold).toBe(1);
    expect(clamped.bloom.strength).toBe(3);
    expect(clamped.bloom.radius).toBe(0);
    expect(clamped.dof.focus).toBe(0.1);
    expect(clamped.dof.aperture).toBe(0.1);
    expect(clamped.dof.maxblur).toBe(0.05);
    expect(clamped.afterimage.damp).toBe(1);
    expect(clamped.bloom.quality).toBe("half");
    expect(
      clampScenePostSettings({
        ...DEFAULT_SCENE_POST,
        bloom: { enabled: true, threshold: 0.5, strength: 1, radius: 0.5, quality: "x" as never },
      }).bloom.quality,
    ).toBe("full");
  });
});

describe("mẫu hiệu ứng mới", () => {
  it("có Sét đánh và Mưa rào; sét gợi ý chớp sáng mạnh", () => {
    const names = EFFECT_PRESETS.map((f) => f.name);
    expect(names).toContain("Sét đánh");
    expect(names).toContain("Mưa rào");
    const lightning = EFFECT_PRESETS.find((f) => f.name === "Sét đánh");
    expect(lightning?.suggestedFlash).toBeGreaterThan(0.5);
  });
});
