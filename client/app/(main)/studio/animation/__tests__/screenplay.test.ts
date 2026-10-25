import { describe, expect, it } from "vitest";
import { parseScreenplay, screenplayToAnimScenes } from "../lib/screenplay";

const SAMPLE = `INT. LỚP HỌC - NGÀY

Thầy giáo bước vào lớp, cả lớp đứng dậy chào.

LINH
Chào buổi sáng ạ! Hôm nay trời đẹp quá.

HÙNG
Linh ơi, đợi tớ với!

EXT. SÂN TRƯỜNG - CHIỀU

CẮT SANG:

LINH
Tan học rồi! Mình ghé hiệu sách nhé.
`;

describe("tách kịch bản", () => {
  it("đầu cảnh INT./EXT. tách thành cảnh riêng, tên bỏ tiền tố", () => {
    const scenes = parseScreenplay(SAMPLE);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].name).toContain("LỚP HỌC");
    expect(scenes[1].name).toContain("SÂN TRƯỜNG");
  });

  it("tên nhân vật viết hoa + câu thoại thành dòng thoại", () => {
    const scenes = parseScreenplay(SAMPLE);
    expect(scenes[0].dialogue[0].speaker).toBe("LINH");
    expect(scenes[0].dialogue[0].text).toContain("Chào buổi sáng");
    expect(scenes[0].dialogue[1].speaker).toBe("HÙNG");
  });

  it("dòng mô tả vào ghi chú cảnh, dòng lạ không bị vứt mất", () => {
    const scenes = parseScreenplay(SAMPLE);
    expect(scenes[0].description.join(" ")).toContain("Thầy giáo bước vào lớp");
    expect(scenes[1].notes.join(" ")).toContain("CẮT SANG");
  });

  it("không có đầu cảnh thì thành một cảnh duy nhất, rỗng thì không có cảnh", () => {
    const one = parseScreenplay("LINH\nXin chào!\n");
    expect(one).toHaveLength(1);
    expect(one[0].dialogue).toHaveLength(1);
    expect(parseScreenplay("   \n\n  ")).toHaveLength(0);
  });

  it("chuyển thành cảnh phim: thoại có mốc tăng dần, thời lượng đủ chứa thoại", () => {
    const scenes = screenplayToAnimScenes(parseScreenplay(SAMPLE));
    expect(scenes).toHaveLength(2);
    const d = scenes[0].dialogue ?? [];
    expect(d.length).toBeGreaterThanOrEqual(2);
    expect(d[1].startSec).toBeGreaterThan(d[0].startSec);
    expect(scenes[0].durationSec).toBeGreaterThanOrEqual(
      d[d.length - 1].startSec + d[d.length - 1].durationSec,
    );
    expect(scenes[0].note).toContain("Thầy giáo bước vào lớp");
  });
});
