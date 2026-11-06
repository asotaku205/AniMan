import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLOUDFLARE_NOVEL_BREAKDOWN_MODELS,
  createCloudflareNovelAiBackend,
  createGeminiNovelAiBackend,
} from "./cloudflare-novel-ai.provider.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function chatCompletion(content: string): unknown {
  return {
    result: {
      choices: [{ message: { role: "assistant", content } }],
    },
    success: true,
    errors: [],
    messages: [],
  };
}

describe("createCloudflareNovelAiBackend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("breakdown gửi JSON Schema và model 70B trước, trích content từ choices", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(chatCompletion('{"pages": []}')),
    );
    vi.stubGlobal("fetch", fetchMock);
    const backend = createCloudflareNovelAiBackend({
      accountId: "acc-123",
      token: "tok-123",
    });
    expect(backend.modelsFor("breakdown")).toEqual([
      ...CLOUDFLARE_NOVEL_BREAKDOWN_MODELS,
    ]);
    const text = await backend.generateText(
      CLOUDFLARE_NOVEL_BREAKDOWN_MODELS[0],
      {
        systemInstruction: "sys",
        userPrompt: "user",
        maxOutputTokens: 4096,
        task: "breakdown",
      },
    );
    expect(text).toBe('{"pages": []}');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/accounts/acc-123/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    const format = sent.response_format as Record<string, unknown>;
    expect(format.type).toBe("json_schema");
    const schema = format.json_schema as Record<string, unknown>;
    expect(schema.name).toBe("novel_breakdown");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer tok-123",
    });
  });

  it("summarize dùng model 8B và response_format json_object", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(chatCompletion('{"summary": "Aoi rời ga."}')),
    );
    vi.stubGlobal("fetch", fetchMock);
    const backend = createCloudflareNovelAiBackend({
      accountId: "acc-123",
      token: "tok-123",
    });
    expect(backend.modelsFor("summarize")).toEqual([
      "@cf/meta/llama-3.1-8b-instruct",
    ]);
    const text = await backend.generateText(
      "@cf/meta/llama-3.1-8b-instruct",
      {
        systemInstruction: "sys",
        userPrompt: "user",
        maxOutputTokens: 2048,
        task: "summarize",
      },
    );
    expect(text).toBe('{"summary": "Aoi rời ga."}');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent.response_format).toEqual({ type: "json_object" });
  });

  it("ném lỗi kèm thông báo Cloudflare khi HTTP lỗi", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { success: false, errors: [{ message: "Model not found" }] },
        404,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const backend = createCloudflareNovelAiBackend({
      accountId: "acc-123",
      token: "tok-123",
    });
    await expect(
      backend.generateText("@cf/meta/llama-3.1-8b-instruct", {
        systemInstruction: "sys",
        userPrompt: "user",
        maxOutputTokens: 2048,
        task: "summarize",
      }),
    ).rejects.toThrow("Model not found");
  });

  it("ném lỗi khi Cloudflare trả success=false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        result: {},
        success: false,
        errors: [{ message: "JSON Mode couldn't be met" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const backend = createCloudflareNovelAiBackend({
      accountId: "acc-123",
      token: "tok-123",
    });
    await expect(
      backend.generateText("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        systemInstruction: "sys",
        userPrompt: "user",
        maxOutputTokens: 4096,
        task: "breakdown",
      }),
    ).rejects.toThrow("JSON Mode couldn't be met");
  });

  it("ném lỗi khi thiếu accountId hoặc token", () => {
    expect(() =>
      createCloudflareNovelAiBackend({ accountId: " ", token: "tok" }),
    ).toThrow("CLOUDFLARE_ACCOUNT_ID");
    expect(() =>
      createCloudflareNovelAiBackend({ accountId: "acc", token: " " }),
    ).toThrow("CLOUDFLARE_API_TOKEN");
  });
});

describe("createGeminiNovelAiBackend", () => {
  it("modelsFor trả model ưu tiên trước rồi fallback, không trùng", () => {
    const backend = createGeminiNovelAiBackend({
      apiKey: "dummy-key",
      preferredModel: "gemini-3.5-flash",
    });
    expect(backend.modelsFor("summarize")[0]).toBe("gemini-3.5-flash");
    expect(new Set(backend.modelsFor("summarize")).size).toBe(
      backend.modelsFor("summarize").length,
    );
  });

  it("ném lỗi khi thiếu apiKey", () => {
    expect(() => createGeminiNovelAiBackend({ apiKey: " " })).toThrow(
      "GEMINI_API_KEY",
    );
  });
});
