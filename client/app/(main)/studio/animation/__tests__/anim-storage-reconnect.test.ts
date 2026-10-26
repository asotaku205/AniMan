// @vitest-environment node
/**
 * Kiểm thử khôi phục kết nối animStorage: khi kết nối IndexedDB bị đóng
 * giữa phiên làm việc, lần lưu sau phải tự mở lại kết nối mới và thử lại
 * thay vì ném lỗi "connection is closing" cho mọi lần lưu còn lại.
 *
 * Hai tình huống được phân biệt rõ:
 * - versionchange (tab khác nâng cấp DB): handler hiện có đã tự bỏ kết
 *   nối cũ và lần lưu sau tự mở lại được, nên không phải nguyên nhân
 *   gây mất dữ liệu bền vững.
 * - đóng kết nối ngoài luồng handler (trình duyệt thu hồi, tab bị loại
 *   bỏ, hoặc đường đóng mà module không quan sát được): kết nối cũ vẫn
 *   nằm trong biến module, mọi lần lưu sau đều ném InvalidStateError.
 *   Đây là lỗi cần sửa, test "kết nối đóng ngoài luồng" phải pass.
 */
import { indexedDB as fakeIdb } from "fake-indexeddb";
import { beforeAll, describe, expect, it, vi } from "vitest";

const DB_NAME = "animan_animation_db";
const captured: IDBDatabase[] = [];

type OpenFn = typeof fakeIdb.open;

beforeAll(() => {
  vi.stubGlobal("window", globalThis);
  const origOpen: OpenFn = fakeIdb.open.bind(fakeIdb);
  const wrappedFactory = {
    open: ((...args: Parameters<OpenFn>) => {
      const req = origOpen(...args);
      req.addEventListener("success", () => {
        captured.push(req.result as IDBDatabase);
      });
      return req;
    }) as OpenFn,
    deleteDatabase: fakeIdb.deleteDatabase.bind(fakeIdb),
    cmp: fakeIdb.cmp.bind(fakeIdb),
  };
  vi.stubGlobal("indexedDB", wrappedFactory);
});

async function freshStorage() {
  vi.resetModules();
  return import("../lib/animStorage");
}

function lastCaptured(): IDBDatabase {
  const db = captured[captured.length - 1];
  expect(db).toBeDefined();
  return db;
}

function openDbVersion(version: number): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = fakeIdb.open(DB_NAME, version);
    req.onupgradeneeded = () => {};
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

describe("animStorage, khôi phục sau khi kết nối đóng", () => {
  it("kết nối đóng ngoài luồng handler: lần lưu sau tự mở lại và ghi bền", async () => {
    const storage = await freshStorage();
    const { createAnimProject } = await import("../lib/animProject");

    const first = createAnimProject("Phim trước khi mất kết nối", "2d");
    first.id = "proj-reconnect-1";
    await storage.saveAnimProject(first);
    expect(await storage.getAnimProject(first.id)).not.toBeNull();

    // Đóng thẳng kết nối mà module đang giữ, giống đường đóng mà handler
    // onversionchange không quan sát được.
    lastCaptured().close();

    const second = createAnimProject("Phim sau khi mất kết nối", "2d");
    second.id = "proj-reconnect-2";
    await storage.saveAnimProject(second);
    const back = await storage.getAnimProject(second.id);
    expect(back).not.toBeNull();
    expect(back!.id).toBe("proj-reconnect-2");

    // Lần lưu tiếp theo vẫn phải làm việc, không chỉ hồi phục một lần.
    const third = createAnimProject("Phim sau khi hồi phục", "2d");
    third.id = "proj-reconnect-3";
    await storage.saveAnimProject(third);
    expect(await storage.getAnimProject(third.id)).not.toBeNull();
  });

  it("file tiếng cũng hồi phục sau khi kết nối đóng ngoài luồng", async () => {
    const storage = await freshStorage();

    const bytes = new Uint8Array([1, 2, 3, 4]);
    await storage.saveVoiceBlob(
      "blob-reconnect-1",
      new Blob([bytes], { type: "audio/webm" }),
    );
    expect(await storage.loadVoiceBlob("blob-reconnect-1")).not.toBeNull();

    lastCaptured().close();

    const bytes2 = new Uint8Array([5, 6, 7]);
    await storage.saveVoiceBlob(
      "blob-reconnect-2",
      new Blob([bytes2], { type: "audio/webm" }),
    );
    const back = await storage.loadVoiceBlob("blob-reconnect-2");
    expect(back).not.toBeNull();
    expect(Array.from(new Uint8Array(await back!.arrayBuffer()))).toEqual([
      5, 6, 7,
    ]);
  });

  it("versionchange: module bỏ kết nối cũ, lần mở sau là kết nối mới", async () => {
    const storage = await freshStorage();
    const { createAnimProject } = await import("../lib/animProject");

    const first = createAnimProject("Phim trước versionchange", "2d");
    first.id = "proj-vc-1";
    await storage.saveAnimProject(first);
    const moduleConn = lastCaptured();

    // Tab khác nâng cấp DB: connection của module nhận versionchange và
    // handler hiện có đóng nó lại.
    const bumped = await openDbVersion(5);
    expect(() => moduleConn.transaction("projects", "readonly")).toThrow();
    bumped.close();

    // Lần lưu sau không dùng lại kết nối đã đóng: module mở kết nối mới.
    // Vì module yêu cầu version 4 trong khi DB đã lên 5, lần mở mới này
    // ném VersionError theo đúng quy tắc version của IndexedDB. Đây là
    // hiện tượng riêng của phép thử nâng cấp nhân tạo, không phải lỗi
    // "connection is closing" trong hiện tượng gốc (nơi không có nâng cấp).
    // Điểm cần chứng minh ở đây: lỗi không còn là InvalidStateError, tức
    // kết nối cũ đã đóng đã bị bỏ, không nằm lại trong biến module.
    let thrown: unknown = null;
    try {
      const second = createAnimProject("Phim sau versionchange", "2d");
      second.id = "proj-vc-2";
      await storage.saveAnimProject(second);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect((thrown as Error).name).toBe("VersionError");
  });
});
