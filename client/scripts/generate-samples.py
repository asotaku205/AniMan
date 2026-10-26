#!/usr/bin/env python3
"""Sinh file JSON mẫu cho loader "Mở dự án mẫu" từ dữ liệu sản xuất thật.

Chỉ ĐỌC dữ liệu ở ~/workspace/AniMan-production (không sửa gì ở đó) và ghi
file JSON vào client/public/samples để app phục vụ qua đường /samples/.

Cách chạy (từ thư mục client):
    python3 scripts/generate-samples.py --only novel
    python3 scripts/generate-samples.py --only manga
    python3 scripts/generate-samples.py

Mọi kiểm tra đều fail nhanh (assert) thay vì sinh dữ liệu lệch âm thầm.
Luật viết toàn cục: đầu ra không chứa em dash, en dash, mũi tên, dấu nhân
hay ký tự vẽ khung.
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROD_ROOT = Path.home() / "workspace" / "AniMan-production"
SAMPLES_DIR = REPO_ROOT / "public" / "samples"

FORBIDDEN = ["—", "–", "→", "×", "─", "│", "┌", "┐", "└", "┘", "├", "┤", "┬", "┴", "┼"]

NOVEL_TITLE = "Thư Gửi Thành Phố Trên Mây"


def check_no_forbidden(text: str, where: str) -> None:
    for ch in FORBIDDEN:
        assert ch not in text, f"Ký tự cấm {ch!r} trong {where}"


def count_words(text: str) -> int:
    stripped = text.strip()
    return 0 if not stripped else len(stripped.split())


def first_sentences(text: str, n: int = 2) -> str:
    """Lấy n câu đầu của đoạn văn. Dấu ... tính là một dấu kết câu."""
    flat = " ".join(text.split())
    sentences: list[str] = []
    i = 0
    start = 0
    while i < len(flat) and len(sentences) < n:
        ch = flat[i]
        if ch in ".!?…":
            j = i
            while j < len(flat) and flat[j] in ".!?…":
                j += 1
            while j < len(flat) and flat[j] in '"”\')]}':
                j += 1
            k = j
            while k < len(flat) and flat[k] == " ":
                k += 1
            if k >= len(flat) or flat[k].isupper():
                sentences.append(flat[start:j].strip())
                start = k
                i = k
                continue
            i = j
        else:
            i += 1
    return " ".join(sentences)


def split_halves(paragraphs: list[str]) -> tuple[str, str]:
    """Chia danh sách đoạn thành nửa đầu và nửa sau, cả hai đều không rỗng."""
    assert len(paragraphs) >= 1, "Chương không có đoạn văn nào"
    if len(paragraphs) == 1:
        text = paragraphs[0]
        mid = len(text) // 2
        cut = text.rfind(" ", 0, mid)
        if cut <= 0:
            cut = mid
        return text[:cut].strip(), text[cut:].strip()
    half = (len(paragraphs) + 1) // 2
    left = "\n\n".join(paragraphs[:half]).strip()
    right = "\n\n".join(paragraphs[half:]).strip()
    assert left and right, "Chia nửa chương ra một bên rỗng"
    return left, right


def parse_novel_chapter(path: Path, number: int) -> dict:
    lines = path.read_text(encoding="utf-8").splitlines()
    title = None
    content_lines: list[str] = []
    seen_title = False
    for line in lines:
        if not seen_title:
            if line.startswith("## "):
                title = line[3:].strip()
                seen_title = True
            continue
        content_lines.append(line)
    assert title is not None, f"{path}: không tìm thấy dòng tiêu đề chương"
    assert title.startswith(f"Chương {number}:"), (
        f"{path}: tiêu đề {title!r} không khớp chương {number}"
    )
    while content_lines and content_lines[-1].strip() == "":
        content_lines.pop()
    assert content_lines and re.match(
        r"^\(Hết chương \d+\.", content_lines[-1].strip()
    ), f"{path}: không thấy dòng kết chương ở cuối"
    content_lines.pop()
    while content_lines and content_lines[-1].strip() == "":
        content_lines.pop()
    content = "\n".join(content_lines).strip()
    assert content, f"{path}: nội dung rỗng"
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]
    left, right = split_halves(paragraphs)
    synopsis = first_sentences(content, 2)
    assert synopsis, f"{path}: không rút được tóm tắt"
    return {
        "order": number - 1,
        "title": title,
        "synopsis": synopsis,
        "contentLeft": left,
        "contentRight": right,
    }


def build_outline_sections() -> dict:
    """Dữ liệu dàn ý mẫu dựng theo cốt truyện.

    PHẦN NÀY KHÔNG CHÉP TỪ FILE PRODUCTION: file production chỉ có truyện,
    dàn ý và hồ sơ. Các tuyến, beat, cung, câu hỏi, sổ tay dưới đây do
    script này dựng mẫu bám sát truyện đã viết (nhân vật, địa điểm, mạch
    4 phần, 20 chương, các điểm gài và trả đã có trong truyện), để mở mẫu
    lên là thấy ngay cách dùng tính năng dàn ý của Novel Studio.
    """
    entities = [
        # Nhân vật (14 người, theo story-bible)
        {"kind": "character", "name": "Mai", "role": "Người giao thư ở Trạm Mây",
         "description": "16 tuổi, giao thư khắp thành phố trên mây, đếm bước để nhớ đường.",
         "traits": "Giữ lời hứa, đếm bước, sợ độ cao",
         "notes": "Từ chương 14 thư ĐÃ MỞ theo lời dặn trên phong bì, không viết là còn niêm phong."},
        {"kind": "character", "name": "Bin", "role": "Thợ máy nhỏ, bạn của Mai",
         "description": "13 tuổi, chế ra chim máy Gió Nhỏ, giỏi sửa đồ và giữ dây.",
         "traits": "Khéo tay, hay quên sạc pin cho Gió Nhỏ",
         "notes": "Học giữ dây từ bố: dây không giữ người, người giữ dây."},
        {"kind": "character", "name": "Ông Tư", "role": "Người giữ đèn hải đăng",
         "description": "70 tuổi, giữ đèn 40 năm, tác giả lá thư không tên.",
         "traits": "Kiên nhẫn, khắc một vết lên đá mỗi năm",
         "notes": "Viết mỗi đêm một dòng trong một tháng, ghi người giữ đèn thay vì tên bà Lan vì sợ quên tên bà."},
        {"kind": "character", "name": "Bà Lan", "role": "Vợ ông Tư, sống ở Nhà Hoa Giấy",
         "description": "Giữ hoa giấy, từng quên ông Tư sau cơn bão 20 năm trước.",
         "traits": "Nhẹ nhàng, nhớ mùi mưa",
         "notes": "Đọc thư dưới ánh đèn, ngửi mùi mưa trước khi đọc."},
        {"kind": "character", "name": "Bà Sáu", "role": "Chủ bưu điện Trạm Mây",
         "description": "60 tuổi, giữ sổ cái bưu điện, nói thư trễ một ngày thì ký ức trễ cả đời.",
         "traits": "Nghiêm mà thương người giao thư",
         "notes": ""},
        {"kind": "character", "name": "Gió Nhỏ", "role": "Chim máy của Bin",
         "description": "Chim máy cần gió thật mới bay, hay hết pin đúng lúc tệ nhất.",
         "traits": "Ham bay, hết pin đúng lúc",
         "notes": ""},
        {"kind": "character", "name": "Khải", "role": "Người giao thư nhanh, đối thủ của Mai",
         "description": "19 tuổi, giao thư nhanh nhưng chỉ giao giấy, sau nhường đường cho Mai.",
         "traits": "Nhanh, thẳng, biết nhận sai",
         "notes": "Chỉ cho Mai bậc thang mẻ trên cầu thang xoắn."},
        {"kind": "character", "name": "Chị Thu", "role": "Thuyền trưởng phà mây",
         "description": "28 tuổi, lái phà mây qua Vực Gió.",
         "traits": "Vững tay lái, nói ít",
         "notes": ""},
        {"kind": "character", "name": "Ông Kính", "role": "Người xem bão ở Đài Quan Sát",
         "description": "65 tuổi, chỉ xuất hiện qua ghi chú và lời kể lại, chưa lộ diện trực tiếp.",
         "traits": "Cẩn thận, báo bão sớm",
         "notes": "Báo bão về trong 3 ngày, dặn thư phải mở bởi đúng người dưới ánh đèn."},
        {"kind": "character", "name": "Chú Ba", "role": "Thợ cầu",
         "description": "50 tuổi, sửa cầu Mây, giữ đèn ở đầu cầu.",
         "traits": "Chắc tay, ít nói",
         "notes": ""},
        {"kind": "character", "name": "Bé Mây", "role": "Bé gái ở Trạm Mây",
         "description": "8 tuổi, hát ru sai lời, quên Mai giữa bão.",
         "traits": "Hồn nhiên, hát sai lời ru",
         "notes": "Cảnh bé quên Mai là cú chạm cảm xúc mạnh nhất phần 3."},
        {"kind": "character", "name": "Bà Bảy", "role": "Người bán bánh",
         "description": "Bán bánh ở chợ Mây, quên mùi bánh của mình khi bão tới.",
         "traits": "Hay quên mùi bánh",
         "notes": "Thước đo thành phố quên nhiều hay ít."},
        {"kind": "character", "name": "Bà Cúc", "role": "Người giữ Trạm Nghỉ",
         "description": "Giữ Trạm Nghỉ, thắp lại đèn cho khách lỡ đường.",
         "traits": "Ấm áp, nhớ tên khách",
         "notes": ""},
        {"kind": "character", "name": "Ông Phát", "role": "Trạm trưởng",
         "description": "Chỉ xuất hiện qua lệnh đóng dấu đỏ, chưa lộ diện trực tiếp, muốn thay đèn dầu bằng đèn điện và cắt tuyến thư.",
         "traits": "Muốn đổi mới nhanh",
         "notes": "Đổi ý khi chính mình quên lá thư vợ để lại."},
        # Địa điểm (11 nơi, theo story-bible)
        {"kind": "place", "name": "Bưu điện Trạm Mây", "role": "Nơi Mai nhận thư",
         "description": "Bưu điện của thành phố, bà Sáu giữ sổ cái.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Chợ Mây", "role": "Chợ trên mây",
         "description": "Nơi bà Bảy bán bánh, Mai chạy qua mỗi sáng.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Cầu Mây", "role": "Cầu nối các khu phố",
         "description": "Cầu mây hay đứt nhịp, chú Ba sửa, Bin giữ dây.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Trạm Nghỉ", "role": "Trạm dừng chân",
         "description": "Bà Cúc giữ, đèn thắp lại cho khách lỡ đường, thư phản ứng với ánh sáng ở đây.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Hải Đăng", "role": "Ngọn đèn giữ ký ức",
         "description": "Ông Tư giữ 40 năm, phòng đèn có 12 cửa sổ, đèn dự phòng cần gió thật.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Đài Quan Sát Bão", "role": "Nơi xem bão",
         "description": "Ông Kính theo dõi Bão Quên từ đây.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Nhà Hoa Giấy", "role": "Nhà của bà Lan",
         "description": "Bà Lan giữ hoa giấy, nơi thư được giao tận tay.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Xưởng của Bin", "role": "Xưởng sửa đồ của Bin",
         "description": "Nơi Bin sửa Gió Nhỏ và làm đồ máy.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Nhà của Mai", "role": "Nhà của Mai",
         "description": "Nhà Mai ở Trạm Mây, nơi Mai bắt đầu ngày giao thư.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Vườn Mây Đào", "role": "Chỉ làm nền xa",
         "description": "Chỉ xuất hiện làm nền xa, không có cảnh diễn ra ở đây.", "traits": "", "notes": ""},
        {"kind": "place", "name": "Đảo Quên", "role": "Chỉ nhắc tên ở phần 3",
         "description": "Chỉ được nhắc tên, không có cảnh diễn ra ở đây.", "traits": "", "notes": ""},
        # Vật phẩm (3 món)
        {"kind": "item", "name": "Lá thư không tên", "role": "Vật phẩm trung tâm",
         "description": "Thư không tên người nhận, không địa chỉ, ông Tư viết cho bà Lan, mang ký ức của người gửi.",
         "traits": "Phản ứng với ánh sáng đèn",
         "notes": "Từ chương 14 thư ĐÃ MỞ theo lời dặn trên phong bì."},
        {"kind": "item", "name": "Chìa khóa đèn dự phòng", "role": "Chìa khóa đồng",
         "description": "Chìa khóa đèn dự phòng, nhận ở chương 9, mở đèn dự phòng ở chương 16.",
         "traits": "Bằng đồng",
         "notes": "Gài trước ở chương 9, trả ở chương 18."},
        {"kind": "item", "name": "Sổ tay của Mai", "role": "Ký ức thứ hai của Mai",
         "description": "Sổ Mai ghi lại những điều mình quên, cứu Mai ở chương 14 và 17.",
         "traits": "Ghi tay, đầy giấy nhắc",
         "notes": ""},
    ]
    plotlines = [
        {"title": "Lá thư không tên", "color": "#f59e0b", "beats": [
            {"title": "Mai nhận lá thư không tên người nhận", "kind": "goal", "sceneChapter": 1},
            {"title": "Thư phản ứng với ánh sáng đèn ở Trạm Nghỉ", "kind": "conflict", "sceneChapter": 4},
            {"title": "Ông Tư nhận thư là của mình, gửi cho bà Lan", "kind": "turn", "sceneChapter": 7},
            {"title": "Mai mở thư theo lời dặn trên phong bì", "kind": "turn", "sceneChapter": 14},
            {"title": "Thư đến tay bà Lan ở Nhà Hoa Giấy", "kind": "result", "sceneChapter": 19},
        ]},
        {"title": "Bão Quên", "color": "#64748b", "beats": [
            {"title": "Thành phố bắt đầu quên", "kind": "goal", "sceneChapter": 2},
            {"title": "Ông Kính báo bão về trong 3 ngày", "kind": "conflict", "sceneChapter": 9},
            {"title": "Bão Quên làm cả thành phố quên theo từng đợt", "kind": "conflict", "sceneChapter": 12},
            {"title": "Mai bắt đầu quên, tự viết giấy nhắc mình", "kind": "turn", "sceneChapter": 13},
            {"title": "Ánh đèn lan ra, thành phố nhớ lại", "kind": "result", "sceneChapter": 19},
        ]},
        {"title": "Ngọn đèn hải đăng", "color": "#eab308", "beats": [
            {"title": "Đèn chớp tắt lần đầu", "kind": "goal", "sceneChapter": 5},
            {"title": "Đèn chính tắt, đèn dự phòng cần gió thật", "kind": "conflict", "sceneChapter": 16},
            {"title": "Mở mọi cửa đón gió vẫn chưa đủ", "kind": "turn", "sceneChapter": 17},
            {"title": "Gió từ bước chạy của Mai thắp sáng đèn", "kind": "result", "sceneChapter": 18},
        ]},
        {"title": "Mai giữ lời hứa", "color": "#22c55e", "beats": [
            {"title": "Mai hứa giao thư đúng hẹn", "kind": "goal", "sceneChapter": 1},
            {"title": "Khải mang lệnh gọi về, Mai từ chối", "kind": "conflict", "sceneChapter": 10},
            {"title": "Mai quên số bước 120, Bin nhắc lại", "kind": "conflict", "sceneChapter": 11},
            {"title": "Mai chạy quanh chân tháp để tạo gió", "kind": "turn", "sceneChapter": 18},
            {"title": "Mai nhận giữ đèn cùng ông Tư", "kind": "result", "sceneChapter": 20},
        ]},
    ]
    arcs = [
        {"characterName": "Mai", "entityName": "Mai",
         "startState": "Người giao thư nhanh nhất, đếm bước để nhớ đường, sợ độ cao",
         "endState": "Người giữ đèn đáng tin nhất, giữ lời hứa bằng sổ tay và bước chân",
         "milestones": [
             {"sceneChapter": 1, "note": "Nhận thư, hứa giao đúng hẹn"},
             {"sceneChapter": 7, "note": "Gặp ông Tư, hiểu thư là của ai"},
             {"sceneChapter": 11, "note": "Quên số bước, nhờ Bin nhắc"},
             {"sceneChapter": 13, "note": "Tự viết giấy nhắc mình khi bắt đầu quên"},
             {"sceneChapter": 18, "note": "Chạy quanh chân tháp tạo gió thắp đèn"},
             {"sceneChapter": 20, "note": "Nhận giữ đèn cùng ông Tư"},
         ]},
        {"characterName": "Bin", "entityName": "Bin",
         "startState": "Thợ máy nhỏ, Gió Nhỏ hay hết pin đúng lúc tệ nhất",
         "endState": "Người nhắc bước cho Mai, sửa được cả cầu và đèn",
         "milestones": [
             {"sceneChapter": 3, "note": "Gió Nhỏ bị gió quật ngã trên cầu Mây"},
             {"sceneChapter": 6, "note": "Dạy Mai cách giữ dây khi qua cầu đứt"},
             {"sceneChapter": 11, "note": "Nhắc số bước 120 cho Mai giữa bão"},
             {"sceneChapter": 13, "note": "Đếm thay Mai khi Mai bắt đầu quên"},
             {"sceneChapter": 18, "note": "Đếm cùng Mai quanh chân tháp"},
         ]},
        {"characterName": "Ông Tư", "entityName": "Ông Tư",
         "startState": "Người giữ đèn 40 năm, quên đường về nhà",
         "endState": "Đoàn tụ với bà Lan dưới ánh đèn",
         "milestones": [
             {"sceneChapter": 7, "note": "Nhận thư là của mình, nhờ Mai mang đi"},
             {"sceneChapter": 15, "note": "40 vết khắc trên đá ở chân hải đăng"},
             {"sceneChapter": 18, "note": "Đếm bước cùng Mai quanh chân tháp"},
             {"sceneChapter": 20, "note": "Đoàn tụ với bà Lan dưới ánh đèn"},
         ]},
        {"characterName": "Khải", "entityName": "Khải",
         "startState": "Đối thủ giao thư nhanh, chỉ giao giấy",
         "endState": "Người nhường đường, chỉ bậc thang mẻ",
         "milestones": [
             {"sceneChapter": 10, "note": "Mang lệnh gọi về nhưng nhường đường cho Mai"},
             {"sceneChapter": 12, "note": "Không giao nổi thư khi thành phố quên"},
         ]},
    ]
    questions = [
        {"question": "Ai viết lá thư không tên?", "plantedChapter": 1, "answeredChapter": 7},
        {"question": "Vì sao thư phản ứng với ánh sáng đèn?", "plantedChapter": 4, "answeredChapter": 14},
        {"question": "Chìa khóa đèn dự phòng dùng để làm gì?", "plantedChapter": 9, "answeredChapter": 18},
        {"question": "Mai có giữ được lời hứa giao thư không?", "plantedChapter": 1, "answeredChapter": 19},
    ]
    # Kiểm tra liên kết nội bộ của dàn ý mẫu.
    names = {e["name"] for e in entities}
    assert len(entities) == 28, f"Sổ tay mẫu cần 28 thực thể, thấy {len(entities)}"
    for pl in plotlines:
        for b in pl["beats"]:
            assert 1 <= b["sceneChapter"] <= 20, f"Beat gắn chương sai: {b}"
            assert b["kind"] in ("goal", "conflict", "turn", "result"), f"Loại beat sai: {b}"
    for a in arcs:
        assert a["entityName"] in names, f"Cung gắn thực thể không có: {a['entityName']}"
        for m in a["milestones"]:
            assert 1 <= m["sceneChapter"] <= 20, f"Mốc gắn chương sai: {m}"
    for q in questions:
        assert 1 <= q["plantedChapter"] < q["answeredChapter"] <= 20, f"Câu hỏi sai: {q}"
    return {
        "plotlines": plotlines,
        "arcs": arcs,
        "questions": questions,
        "entities": entities,
        "snapshot": {
            "name": "Bản mẫu hoàn chỉnh",
            "note": "Bản mẫu Thư Gửi Thành Phố Trên Mây lúc mở mẫu: đủ 20 chương, dàn ý, tuyến truyện, cung nhân vật, câu hỏi và sổ tay.",
        },
    }


def build_novel_sample() -> dict:
    bible = (PROD_ROOT / "story-bible.md").read_text(encoding="utf-8")
    bible_lines = bible.splitlines()
    premise = ""
    for i, line in enumerate(bible_lines):
        if line.strip() == "## Logline":
            for nxt in bible_lines[i + 1 :]:
                if nxt.strip():
                    premise = nxt.strip()
                    break
            break
    assert premise, "Không tìm thấy logline trong story-bible"
    in_structure = False
    bullets: list[str] = []
    for line in bible_lines:
        if line.strip() == "## Cấu trúc tổng thể: 4 phần, 20 chương, ~100 trang (~40.000 từ)":
            in_structure = True
            continue
        if in_structure:
            if line.startswith("## "):
                break
            if line.startswith("- **Phần"):
                bullets.append(line.strip())
    assert len(bullets) == 4, f"Cần đúng 4 bullet phần, thấy {len(bullets)}"
    summaries: list[str] = []
    for bullet in bullets:
        parts = bullet.split(":** ", 1)
        assert len(parts) == 2, f"Bullet phần sai dạng: {bullet[:60]}"
        summaries.append(parts[1].strip())
    summary = " ".join(summaries)
    outline = "\n".join(bullets)

    chapters: list[dict] = []
    total_words = 0
    for number in range(1, 21):
        part = (number - 1) // 5 + 1
        path = PROD_ROOT / "novel" / f"phan-0{part}" / f"chuong-{number:02d}.md"
        assert path.exists(), f"Thiếu file chương: {path}"
        chapter = parse_novel_chapter(path, number)
        total_words += count_words(chapter["contentLeft"])
        total_words += count_words(chapter["contentRight"])
        chapters.append(chapter)
    sample = {
        "format": "animan-novel-sample",
        "version": 1,
        "title": NOVEL_TITLE,
        "premise": premise,
        "summary": summary,
        "outline": outline,
        "chapters": chapters,
        **build_outline_sections(),
    }
    text = json.dumps(sample, ensure_ascii=False)
    check_no_forbidden(text, "novel JSON")
    print(f"Novel: 20 chương, {total_words} từ nội dung.")
    assert total_words > 37000, f"Tổng từ novel quá thấp: {total_words}"
    return sample


MANGA_KNOWN_NAMES = [
    "Mai", "Bin", "Ông Tư", "Bà Lan", "Bà Sáu", "Gió Nhỏ", "Khải",
    "Chị Thu", "Ông Kính", "Chú Ba", "Bé Mây", "Bà Bảy", "Bà Cúc", "Ông Phát",
]
MANGA_NAME_ALIASES = {"Lan": "Bà Lan"}


def manga_sentence_names(sentence: str) -> list[str]:
    """Các tên nhân vật xuất hiện trong một câu, theo thứ tự xuất hiện."""
    found = []
    for name in MANGA_KNOWN_NAMES:
        if re.search(rf"(?<!\w){re.escape(name)}(?!\w)", sentence):
            found.append(name)
    return found


def manga_resolve_inner_speaker(panel_text_before_cue: str) -> str | None:
    """Tìm người nghĩ thầm: câu kể gần nhất trước lời thoại chỉ nhắc đúng 1 tên.

    Bỏ trích dẫn trước đó ra khỏi text rồi mới chia câu, để lời thoại cũ
    không bị tính là câu kể.
    """
    narration = re.sub(r'"[^"]*"', " ", panel_text_before_cue)
    for sentence in reversed(split_sentences(narration)):
        names = manga_sentence_names(sentence)
        if len(names) == 1:
            return names[0]
    return None


SPEECH_VERBS = r"đếm|nói|hỏi|gọi|hát|đọc|kể|thì thầm|hét|cười"


def split_sentences(text: str) -> list[str]:
    """Chia thành câu theo dấu kết câu, dấu ngoặc kép đóng, ngoặc đơn đóng."""
    parts: list[str] = []
    start = 0
    for m in re.finditer(r"(?:[.!?…][\"”\)]?|[\"”\)])\s+", text):
        piece = text[start:m.end()].strip()
        if piece:
            parts.append(piece)
        start = m.end()
    tail = text[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def manga_written_source(cue: str) -> str | None:
    """Nguồn chữ viết trong lời dẫn, lấy từ chữ, giấy, phong bì, bảng."""
    lowered = cue.lower()
    for pattern in (
        r"dòng chữ[^,]*",
        r"chữ[^,]*",
        r"mẩu giấy[^,]*",
        r"tờ giấy[^,]*",
        r"phong bì[^,]*",
        r"bảng[^,]*",
    ):
        m = re.search(pattern, lowered)
        if m:
            start, end = m.span()
            return cue[start:end].strip()
    return None


def manga_name_at_start(cue: str) -> str | None:
    """Tên nhân vật mở đầu lời dẫn (không phân biệt hoa thường ở chức danh)."""
    lowered = cue.lower()
    for name in MANGA_KNOWN_NAMES:
        low = name.lower()
        if lowered == low or lowered.startswith(low + " ") or lowered.startswith(low + " ("):
            return name
    for alias, real in MANGA_NAME_ALIASES.items():
        low = alias.lower()
        if lowered == low or lowered.startswith(low + " ") or lowered.startswith(low + " ("):
            return real
    return None


def manga_classify_quote(panel_text: str, quote_start: int, prev_end: int) -> dict:
    """Phân loại một đoạn trích dẫn trong khung hình.

    Quy tắc trung thực, không đoán mò người nói. Lời dẫn chỉ lấy trong
    đoạn từ cuối trích dẫn trước tới trích dẫn này, để lời thoại trong
    trích dẫn trước không lọt vào lời dẫn sau.
    - Lời mở đầu bằng tên nhân vật (kèm ghi chú trong ngoặc nếu có) thì
      người nói là tên đó.
    - Thoại nội tâm có tên trong ngoặc thì lấy tên đó, không có tên thì
      tìm câu gần nhất trước đó chỉ nhắc đúng 1 tên, không có thì để trống.
    - Chữ viết (chữ trong sổ, mẩu giấy, bảng...) thì ghi nguồn chữ.
    - Tiếng kêu trong lời kể (kêu một tiếng "cạch") thì tính là SFX.
    - Lời mở đầu bằng đại từ hoặc động từ (Cậu, Cô, Bà, hét lên...) thì
      để trống người nói, không đoán từ ngữ cảnh.
    - Mảnh chữ nhấn trong lời kể (không phải lời thoại) thì ghi loại
      narration, loader sẽ không nhập làm chữ lồng tiếng.
    """
    segment = panel_text[prev_end:quote_start]
    preceding = segment.rstrip()
    if not preceding.endswith(":"):
        if re.search(r"chữ\s*$", preceding):
            return {"kind": "written", "source": "chữ"}
        if re.search(r"tiếng\s*$", preceding):
            return {"kind": "sfx"}
        stripped = preceding.strip()
        if re.search(r"[.!?…][\"”\)]?\s*$", stripped) or prev_end == 0:
            sentences = split_sentences(stripped)
            last_sentence = sentences[-1] if sentences else stripped
            names = manga_sentence_names(last_sentence)
            if len(names) == 1 and re.search(SPEECH_VERBS, last_sentence):
                return {"kind": "spoken", "speaker": names[0]}
        if re.search(rf"({SPEECH_VERBS})\s*$", preceding):
            return {"kind": "spoken", "speaker": None}
        return {"kind": "narration"}
    cue_full = preceding[:-1].rstrip()
    sentences = split_sentences(cue_full)
    cue = sentences[-1] if sentences else cue_full
    inner = re.match(r"^Thoại\s*\(([^)]*)\)$", cue)
    if inner:
        inside = inner.group(1)
        for name in MANGA_KNOWN_NAMES:
            if re.search(rf"(?<!\w){re.escape(name)}(?!\w)", inside):
                return {"kind": "inner", "speaker": name}
        return {
            "kind": "inner",
            "speaker": manga_resolve_inner_speaker(panel_text[:quote_start]),
        }
    source = manga_written_source(cue)
    if source is not None:
        return {"kind": "written", "source": source}
    name = manga_name_at_start(cue)
    if name is not None:
        return {"kind": "spoken", "speaker": name}
    return {"kind": "spoken", "speaker": None}


def manga_parse_panel(raw: str) -> list[dict]:
    """Tách lời thoại, chữ viết và SFX từ text một khung hình."""
    lines: list[tuple[int, dict]] = []
    sfx_match = re.search(r"SFX:\s*(.+?)\s*$", raw)
    text = raw
    if sfx_match:
        sfx_text = sfx_match.group(1).strip()
        if sfx_text.endswith("."):
            sfx_text = sfx_text[:-1].strip()
        assert sfx_text, "SFX rỗng"
        lines.append((sfx_match.start(), {"kind": "sfx", "text": sfx_text}))
        text = raw[: sfx_match.start()].rstrip()
    prev_end = 0
    for m in re.finditer(r'"([^"]+)"', text):
        content = " ".join(m.group(1).split())
        assert content, "Trích dẫn rỗng trong khung hình"
        found = manga_classify_quote(text, m.start(), prev_end)
        lines.append((m.start(), {**found, "text": content}))
        prev_end = m.end()
    lines.sort(key=lambda item: item[0])
    return [line for _, line in lines]


def manga_parse_chapter(path: Path, number: int) -> dict:
    raw_lines = path.read_text(encoding="utf-8").splitlines()
    title = None
    pages: list[dict] = []
    current_page: dict | None = None
    current_panel: dict | None = None
    for line in raw_lines:
        if line.startswith("# Manga chương "):
            assert title is None, f"{path}: hai tiêu đề chương"
            title = line[len("# Manga chương "):].strip()
            assert title.startswith(f"{number}:"), (
                f"{path}: tiêu đề {title!r} không khớp chương {number}"
            )
            title = title[len(f"{number}:"):].strip()
            continue
        if line.startswith("## Trang "):
            header = line[len("## Trang "):].strip()
            page_num, _, page_title = header.partition(":")
            assert current_page is None or len(current_page["panels"]) == 5, (
                f"{path}: trang chưa đủ 5 khung đã sang trang mới"
            )
            assert int(page_num) == len(pages) + 1, (
                f"{path}: số trang lệch: {page_num}"
            )
            current_page = {
                "number": int(page_num),
                "title": page_title.strip(),
                "panels": [],
            }
            pages.append(current_page)
            current_panel = None
            continue
        bullet = re.match(r"^- Khung (\d+) \(([^)]*)\):\s*(.*)$", line)
        if bullet:
            assert current_page is not None, f"{path}: khung ngoài trang"
            assert int(bullet.group(1)) == len(current_page["panels"]) + 1, (
                f"{path}: số khung lệch: {bullet.group(1)}"
            )
            current_panel = {
                "number": int(bullet.group(1)),
                "shot": bullet.group(2).strip(),
                "raw": bullet.group(3).strip(),
            }
            current_page["panels"].append(current_panel)
            continue
        if line.strip() == "":
            continue
        if line.startswith("(Hết manga chương "):
            assert line.startswith(f"(Hết manga chương {number}."), (
                f"{path}: dòng kết chương sai số: {line[:60]!r}"
            )
            current_panel = None
            continue
        if line.startswith(" ") or line.startswith("\t"):
            assert current_panel is not None, f"{path}: dòng nối ngoài khung"
            current_panel["raw"] += " " + line.strip()
            continue
        if current_panel is None:
            continue
        raise AssertionError(f"{path}: dòng lạ trong khung: {line[:60]!r}")
    assert title, f"{path}: không tìm thấy tiêu đề chương"
    assert len(pages) == 6, f"{path}: cần 6 trang, thấy {len(pages)}"
    out_pages = []
    for page in pages:
        assert len(page["panels"]) == 5, (
            f"{path} trang {page['number']}: cần 5 khung"
        )
        out_panels = []
        for panel in page["panels"]:
            raw = panel["raw"]
            assert raw.count('"') % 2 == 0, (
                f"{path} trang {page['number']} khung {panel['number']}: "
                "dấu ngoặc kép lẻ"
            )
            out_panels.append({
                "number": panel["number"],
                "shot": panel["shot"],
                "visual": raw,
                "lines": manga_parse_panel(raw),
            })
        out_pages.append({
            "number": page["number"],
            "title": page["title"],
            "panels": out_panels,
        })
    return {"number": number, "title": title, "pages": out_pages}


def build_manga_sample() -> dict:
    chapters: list[dict] = []
    total_panels = 0
    total_lines = 0
    by_kind: dict[str, int] = {}
    unattributed: list[str] = []
    for number in range(1, 9):
        path = PROD_ROOT / "manga" / f"chuong-{number:02d}-script.md"
        assert path.exists(), f"Thiếu file kịch bản: {path}"
        chapter = manga_parse_chapter(path, number)
        chapters.append(chapter)
        for page in chapter["pages"]:
            for panel in page["panels"]:
                total_panels += 1
                for line in panel["lines"]:
                    total_lines += 1
                    by_kind[line["kind"]] = by_kind.get(line["kind"], 0) + 1
                    if line["kind"] in ("spoken", "inner") and not line.get("speaker"):
                        unattributed.append(
                            f"ch{number} p{page['number']} khung {panel['number']}: "
                            f"{line['text'][:60]}"
                        )
    assert total_panels == 240, f"Cần 240 khung, thấy {total_panels}"
    sample = {
        "format": "animan-manga-sample",
        "version": 1,
        "title": NOVEL_TITLE,
        "genre": "Phiêu lưu, đời thường",
        "description": (
            "Bản manga chuyển thể từ tiểu thuyết Thư Gửi Thành Phố Trên Mây: "
            "8 chương, 48 trang, lời thoại giữ câu đắt nhất của novel."
        ),
        "chapters": chapters,
    }
    text = json.dumps(sample, ensure_ascii=False)
    check_no_forbidden(text, "manga JSON")
    print(f"Manga: 8 chương, 48 trang, {total_panels} khung, {total_lines} dòng.")
    print(f"Manga theo loại: {by_kind}")
    print(f"Manga chưa rõ người nói: {len(unattributed)} dòng.")
    for item in unattributed:
        print(f"  - {item}")
    return sample


def main() -> int:
    args = set(sys.argv[1:])
    only = None
    if "--only" in sys.argv:
        idx = sys.argv.index("--only")
        only = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    if only in (None, "novel"):
        sample = build_novel_sample()
        out = SAMPLES_DIR / "thu-gui-thanh-pho-tren-may-novel.json"
        out.write_text(
            json.dumps(sample, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Đã ghi {out} ({out.stat().st_size} bytes)")
    if only in (None, "manga"):
        sample = build_manga_sample()
        out = SAMPLES_DIR / "thu-gui-thanh-pho-tren-may-manga.json"
        out.write_text(
            json.dumps(sample, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Đã ghi {out} ({out.stat().st_size} bytes)")
    if only not in (None, "novel", "manga"):
        print(f"Lựa chọn không hợp lệ: {only}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
