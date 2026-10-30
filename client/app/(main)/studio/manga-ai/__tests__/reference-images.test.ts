// @vitest-environment node
/**
 * Ảnh mẫu tham khảo: lịch sử tối đa 3 ảnh, lưu riêng khỏi lớp vẽ, không
 * bao giờ vào xuất bản. Kho IndexedDB dùng fake-indexeddb như các test
 * kho khác của client.
 */
import { indexedDB as fakeIdb } from "fake-indexeddb";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  clampReferenceOverlayOpacity,
  DEFAULT_REFERENCE_OVERLAY_OPACITY,
  MAX_REFERENCE_IMAGES,
  addReferenceImageToHistory,
  referenceImageIsOutsideLayers,
  removeReferenceImageFromHistory,
  resolveReferenceImageOutputSize,
  resolveReferenceOverlayImage,
  type ReferenceImageItem,
} from "../lib/referenceImages";
import { REFERENCE_IMAGE_LINE_STYLE } from "../lib/referenceImagePrompt";

beforeAll(() => {
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("indexedDB", fakeIdb);
});

function item(id: string): ReferenceImageItem {
  return {
    id,
    dataUrl: `data:image/png;base64,${id}`,
    source: "drawing-prompt",
    createdAt: Number(id.slice(1)),
  };
}

describe("Lịch sử ảnh mẫu: tối đa 3, mới nhất trước, loại ảnh cũ nhất", () => {
  it("giới hạn đúng 3 ảnh", () => {
    expect(MAX_REFERENCE_IMAGES).toBe(3);
  });

  it("thêm ảnh mới lên đầu, giữ đúng thứ tự", () => {
    const history = addReferenceImageToHistory(
      [item("a1"), item("a2")],
      item("a3"),
    );
    expect(history.map((entry) => entry.id)).toEqual(["a3", "a1", "a2"]);
  });

  it("ảnh thứ 4 loại ảnh cũ nhất", () => {
    const history = addReferenceImageToHistory(
      [item("a3"), item("a2"), item("a1")],
      item("a4"),
    );
    expect(history.map((entry) => entry.id)).toEqual(["a4", "a3", "a2"]);
  });

  it("thêm lại ảnh đã có thì dồn lên đầu, không trùng", () => {
    const history = addReferenceImageToHistory(
      [item("a3"), item("a2"), item("a1")],
      item("a1"),
    );
    expect(history.map((entry) => entry.id)).toEqual(["a1", "a3", "a2"]);
  });

  it("xóa một ảnh khỏi lịch sử", () => {
    const history = removeReferenceImageFromHistory(
      [item("a3"), item("a2"), item("a1")],
      "a2",
    );
    expect(history.map((entry) => entry.id)).toEqual(["a3", "a1"]);
  });
});

describe("Kho ảnh mẫu: ghi/đọc lại theo khung, tách khỏi lớp vẽ", () => {
  it("ghi rồi đọc lại còn nguyên, theo đúng khung", async () => {
    const { addReferenceImage, loadReferenceImages } = await import(
      "../lib/referenceImageStorage"
    );
    await addReferenceImage("panel-a", item("a1"));
    await addReferenceImage("panel-a", item("a2"));
    await addReferenceImage("panel-b", item("b1"));

    expect((await loadReferenceImages("panel-a")).map((entry) => entry.id)).toEqual(
      ["a2", "a1"],
    );
    expect((await loadReferenceImages("panel-b")).map((entry) => entry.id)).toEqual(
      ["b1"],
    );
    expect(await loadReferenceImages("panel-trong")).toEqual([]);
  });

  it("ghi 4 ảnh thì ảnh cũ nhất bị loại khỏi kho", async () => {
    const { addReferenceImage, loadReferenceImages } = await import(
      "../lib/referenceImageStorage"
    );
    await addReferenceImage("panel-c", item("a1"));
    await addReferenceImage("panel-c", item("a2"));
    await addReferenceImage("panel-c", item("a3"));
    await addReferenceImage("panel-c", item("a4"));

    expect((await loadReferenceImages("panel-c")).map((entry) => entry.id)).toEqual(
      ["a4", "a3", "a2"],
    );
  });

  it("xóa một ảnh rồi đọc lại không còn ảnh đó", async () => {
    const { addReferenceImage, deleteReferenceImage, loadReferenceImages } =
      await import("../lib/referenceImageStorage");
    await addReferenceImage("panel-d", item("a1"));
    await addReferenceImage("panel-d", item("a2"));
    await deleteReferenceImage("panel-d", "a2");

    expect((await loadReferenceImages("panel-d")).map((entry) => entry.id)).toEqual(
      ["a1"],
    );
  });

  it("ảnh mẫu không nằm trong stack lớp vẽ sau khi chuẩn hóa", async () => {
    const { normalizePanelStacks } = await import("../lib/mangaStorage");
    const raw: Record<string, unknown> = {
      p1: {
        panelId: "p1",
        layers: [
          {
            id: "user-1",
            name: "Lớp 1",
            kind: "user",
            visible: true,
            locked: false,
            opacity: 1,
          },
        ],
        pixels: { "user-1": "data:image/png;base64,x" },
        activeLayerId: "user-1",
        // Dữ liệu cũ/lạ có trường ảnh mẫu: phải bị loại khi chuẩn hóa.
        referenceImages: [item("a1")],
      },
    };
    const stacks = normalizePanelStacks(raw);
    const stack = stacks.p1;
    expect(stack).toBeDefined();
    expect("referenceImages" in stack).toBe(false);
    expect(Object.keys(stack.pixels)).toEqual(["user-1"]);
  });
});

describe("Ảnh mẫu không vào lớp vẽ và không vào xuất bản", () => {
  it("id ảnh mẫu không trùng id lớp nào", () => {
    expect(referenceImageIsOutsideLayers(["user-1"], ["a1"])).toBe(true);
    expect(referenceImageIsOutsideLayers(["a1"], ["a1"])).toBe(false);
  });

  it("đường xuất của hook không đọc kho ảnh mẫu", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const hookPath = path.resolve(
      import.meta.dirname,
      "../hooks/useDrawStudio.ts",
    );
    const source = fs.readFileSync(hookPath, "utf8");
    const exportNames = ["exportCurrentPanel", "exportFullPage", "exportProjectPdf"];
    for (const name of exportNames) {
      const start = source.indexOf(`const ${name}`);
      expect(start).toBeGreaterThan(-1);
      const end = source.indexOf("\n  },", start);
      const body = source.slice(start, end === -1 ? undefined : end);
      expect(body).not.toMatch(/referenceImage/i);
    }
  });

  it("system prompt ảnh mẫu chưa nối vào lời gọi model nào", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const apiPath = path.resolve(import.meta.dirname, "../../../../../lib/ai-drawing-api.ts");
    const source = fs.readFileSync(apiPath, "utf8");
    expect(source).not.toMatch(/REFERENCE_IMAGE_LINE_STYLE/);
  });

  it("phong cách nét vẽ giữ đúng nội dung đã duyệt: trắng đen, không màu, nét mực", () => {
    expect(REFERENCE_IMAGE_LINE_STYLE).toContain(
      "Black-and-white manga line drawing ONLY",
    );
    expect(REFERENCE_IMAGE_LINE_STYLE).toContain("only black and white");
    expect(REFERENCE_IMAGE_LINE_STYLE).toContain("no color of any kind");
    expect(REFERENCE_IMAGE_LINE_STYLE).toContain(
      "Fill the whole frame edge to edge",
    );
    expect(REFERENCE_IMAGE_LINE_STYLE).not.toContain(
      "You are a drawing reference assistant",
    );
  });
});

describe("Kích thước ảnh mẫu theo đúng tỉ lệ khung đang vẽ", () => {
  it("khung ngang 1200x896 ra 1024x768, khung rong ra 1024x512", () => {
    expect(resolveReferenceImageOutputSize(1200, 896)).toEqual({
      width: 1024,
      height: 768,
    });
    expect(resolveReferenceImageOutputSize(2400, 1216)).toEqual({
      width: 1024,
      height: 512,
    });
  });

  it("khung dọc thì cạnh dài nhất vẫn 1024, làm tròn theo bội số 16", () => {
    expect(resolveReferenceImageOutputSize(768, 1536)).toEqual({
      width: 512,
      height: 1024,
    });
    expect(resolveReferenceImageOutputSize(1024, 1024)).toEqual({
      width: 1024,
      height: 1024,
    });
  });

  it("không có kích thước khung hợp lệ thì giữ 1024x1024", () => {
    expect(resolveReferenceImageOutputSize()).toEqual({
      width: 1024,
      height: 1024,
    });
    expect(resolveReferenceImageOutputSize(null, 896)).toEqual({
      width: 1024,
      height: 1024,
    });
    expect(resolveReferenceImageOutputSize(0, 896)).toEqual({
      width: 1024,
      height: 1024,
    });
    expect(resolveReferenceImageOutputSize(Number.NaN, 896)).toEqual({
      width: 1024,
      height: 1024,
    });
  });
});

describe("Lớp ảnh mẫu đè lên khung vẽ để đồ theo", () => {
  it("chưa chọn thì đè ảnh mới nhất, đã chọn thì đè đúng ảnh đó", () => {
    const images = [item("a1"), item("a2")];
    expect(resolveReferenceOverlayImage(images, null)?.id).toBe("a1");
    expect(resolveReferenceOverlayImage(images, "a2")?.id).toBe("a2");
  });

  it("id đã xóa thì quay về ảnh mới nhất, không ảnh thật thì null", () => {
    const images = [item("a1"), item("a2")];
    expect(resolveReferenceOverlayImage(images, "a9")?.id).toBe("a1");
    expect(resolveReferenceOverlayImage([], null)).toBeNull();
    const placeholder = { ...item("a1"), dataUrl: "" };
    expect(resolveReferenceOverlayImage([placeholder], "a1")).toBeNull();
  });

  it("độ mờ mặc định 40 và luôn kẹp trong 0 tới 100", () => {
    expect(DEFAULT_REFERENCE_OVERLAY_OPACITY).toBe(40);
    expect(clampReferenceOverlayOpacity(40)).toBe(40);
    expect(clampReferenceOverlayOpacity(-5)).toBe(0);
    expect(clampReferenceOverlayOpacity(150)).toBe(100);
    expect(clampReferenceOverlayOpacity(Number.NaN)).toBe(40);
  });
});
