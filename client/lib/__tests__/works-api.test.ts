// @vitest-environment node
/**
 * API tác phẩm phía client (Lát 2A): giới hạn tải lên, tham số query,
 * đọc envelope phân trang, dịch mã lỗi sang tiếng Việt, và đường tải
 * file dự phòng bằng fetch khi không có XMLHttpRequest.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import type { AuthenticatedFetch } from "@/lib/auth-api";
import {
  checkWorkUploadLimits,
  listMyWorks,
  listPublicWorks,
  listReviewQueue,
  resubmitWork,
  reviewWork,
  submitWork,
  translateWorksError,
  WorksApiError,
  type WorkSubmission,
} from "@/lib/works-api";

function workSubmission(overrides: Partial<WorkSubmission> = {}): WorkSubmission {
  return {
    id: "work-1",
    author: { id: "author-1", username: "son", displayName: "Sơn" },
    type: "manga",
    title: "Lá thư mùa hạ",
    description: "Một bộ truyện ngắn.",
    genre: "Slice of life",
    tags: ["summer"],
    visibility: "public",
    status: "pending",
    rejectReason: null,
    fileName: "page.png",
    fileSize: 1024,
    mimeType: "image/png",
    sourceRef: null,
    coverUrl: "/works/work-1/cover",
    fileUrl: "/works/work-1/file",
    reviewedAt: null,
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("checkWorkUploadLimits", () => {
  it("cho phép file đúng giới hạn theo loại", () => {
    expect(
      checkWorkUploadLimits(
        "animation",
        { size: 1024 * 1024 * 1024, name: "ep.mp4" },
        null,
      ),
    ).toBeNull();
    expect(
      checkWorkUploadLimits("manga", { size: 100 * 1024 * 1024, name: "v.cbz" }, null),
    ).toBeNull();
  });

  it("từ chối video quá 1GB và tác phẩm khác quá 100MB", () => {
    expect(
      checkWorkUploadLimits(
        "animation",
        { size: 1024 * 1024 * 1024 + 1, name: "ep.mp4" },
        null,
      ),
    ).toContain("1GB");
    expect(
      checkWorkUploadLimits("novel", { size: 100 * 1024 * 1024 + 1, name: "n.pdf" }, null),
    ).toContain("100MB");
  });

  it("từ chối ảnh bìa quá 5MB và file trống", () => {
    expect(
      checkWorkUploadLimits(
        "manga",
        { size: 10, name: "p.png" },
        { size: 5 * 1024 * 1024 + 1, name: "c.png" },
      ),
    ).toContain("5MB");
    expect(checkWorkUploadLimits("manga", { size: 0, name: "p.png" }, null)).toContain(
      "trống",
    );
  });
});

describe("listPublicWorks", () => {
  it("gọi đúng URL công khai và đọc envelope phân trang", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({
      items: [workSubmission({ status: "approved" })],
      total: 1,
      page: 1,
      pageSize: 20,
    }));
    const list = await listPublicWorks(
      { page: 1, pageSize: 20 },
      fetchFn as unknown as typeof fetch,
    );
    expect(fetchFn).toHaveBeenCalledWith("/works?page=1&pageSize=20", {
      method: "GET",
      signal: undefined,
    });
    expect(list.total).toBe(1);
    expect(list.items[0]?.status).toBe("approved");
  });

  it("báo lỗi kết nối khi fetch ném TypeError", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      listPublicWorks({}, fetchFn as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 0 });
  });
});

describe("listMyWorks", () => {
  it("gọi /works/mine kèm trạng thái lọc", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 }),
    ) as unknown as AuthenticatedFetch;
    await listMyWorks(fetchFn, { status: "rejected" });
    expect(fetchFn).toHaveBeenCalledWith("/works/mine?status=rejected", {
      method: "GET",
      signal: undefined,
    });
  });
});

describe("resubmitWork", () => {
  it("gọi PATCH resubmit và trả về tác phẩm chờ duyệt", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(workSubmission({ status: "pending" })),
    ) as unknown as AuthenticatedFetch;
    const updated = await resubmitWork(fetchFn, "work-1");
    expect(fetchFn).toHaveBeenCalledWith("/works/work-1/resubmit", {
      method: "PATCH",
    });
    expect(updated.status).toBe("pending");
    expect(updated.rejectReason).toBeNull();
  });

  it("dịch lỗi 409 thành câu tiếng Việt", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        { message: "Only rejected submissions can be resubmitted." },
        409,
      ),
    ) as unknown as AuthenticatedFetch;
    await expect(resubmitWork(fetchFn, "work-1")).rejects.toThrowError(
      "Chỉ gửi duyệt lại được tác phẩm đã bị từ chối.",
    );
  });
});

describe("listReviewQueue", () => {
  it("đọc counts của hàng đợi duyệt", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        items: [workSubmission()],
        total: 1,
        page: 1,
        pageSize: 20,
        counts: { pending: 1, approved: 2, rejected: 0, total: 3 },
      }),
    ) as unknown as AuthenticatedFetch;
    const queue = await listReviewQueue(fetchFn, { status: "pending" });
    expect(fetchFn).toHaveBeenCalledWith("/api/admin/works?status=pending", {
      method: "GET",
      signal: undefined,
    });
    expect(queue.counts).toEqual({
      pending: 1,
      approved: 2,
      rejected: 0,
      total: 3,
    });
  });
});

describe("reviewWork", () => {
  it("duyệt không cần body, từ chối gửi kèm lý do", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(workSubmission({ status: "approved" })),
    );
    const asFetch = fetchFn as unknown as AuthenticatedFetch;
    await reviewWork(asFetch, "work-1", "approve");
    expect(fetchFn).toHaveBeenCalledWith("/api/admin/works/work-1/approve", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    fetchFn.mockClear();
    fetchFn.mockResolvedValueOnce(
      jsonResponse(
        workSubmission({ status: "rejected", rejectReason: "Chưa đạt yêu cầu." }),
      ),
    );
    await reviewWork(asFetch, "work-1", "reject", "Chưa đạt yêu cầu.");
    expect(fetchFn).toHaveBeenCalledWith("/api/admin/works/work-1/reject", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Chưa đạt yêu cầu." }),
    });
  });
});

describe("translateWorksError", () => {
  it("dịch thông báo đã biết của server", () => {
    expect(translateWorksError({ message: "Work file is required." }, 400)).toBe(
      "Chưa chọn file tác phẩm.",
    );
    expect(
      translateWorksError({ message: "Cover image exceeds 5MB." }, 413),
    ).toBe("Ảnh bìa vượt quá giới hạn 5MB.");
    expect(
      translateWorksError(
        { message: "Only pending submissions can be reviewed." },
        409,
      ),
    ).toBe("Chỉ duyệt được tác phẩm đang chờ duyệt.");
  });

  it("rơi về theo HTTP status khi không nhận ra thông báo", () => {
    expect(translateWorksError({}, 401)).toContain("đăng nhập lại");
    expect(translateWorksError({}, 413)).toContain("giới hạn");
  });
});

describe("submitWork (fetch fallback, không có XMLHttpRequest)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gửi FormData kèm token và báo 100% khi xong", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return jsonResponse(workSubmission({ status: "pending" }));
    });
    vi.stubGlobal("fetch", fetchFn);

    const formData = new FormData();
    formData.set("title", "Lá thư mùa hạ");
    formData.set("type", "manga");
    formData.set("file", new File(["x"], "page.png", { type: "image/png" }));

    const onProgress = vi.fn();
    const result = await submitWork(
      { getAccessToken: () => "token-1" },
      formData,
      onProgress,
    );
    expect(result.status).toBe("pending");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/works");
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-1");
    expect(calls[0]?.init.body).toBe(formData);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });

  it("ném WorksApiError đã dịch khi server trả 413", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ message: "File exceeds the maximum allowed size." }, 413),
    );
    vi.stubGlobal("fetch", fetchFn);
    const formData = new FormData();
    formData.set("file", new File(["x"], "page.png", { type: "image/png" }));
    await expect(
      submitWork({ getAccessToken: () => "token-1" }, formData),
    ).rejects.toBeInstanceOf(WorksApiError);
    await expect(
      submitWork({ getAccessToken: () => "token-1" }, formData),
    ).rejects.toThrowError("File vượt quá giới hạn cho phép.");
  });
});
