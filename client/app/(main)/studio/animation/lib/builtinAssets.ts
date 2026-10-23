/**
 * Gói tài sản đẹp CÓ SẴN (Đợt Đ2): nhân vật có biểu cảm và nền chi tiết,
 * vẽ bằng canvas ngay tại trình duyệt khi người dùng chọn — thêm thẳng
 * vào cảnh hoặc lưu vào thư viện riêng. Chất lượng "đẹp sẵn" ở mức hình
 * vẽ phẳng chỉn chu (có đổ bóng, chi tiết), không thay thế được hình vẽ
 * tay của người dùng nhưng hơn hẳn thẻ màu/hình khối.
 */

import type { ImageAssetCategory } from "./animAssets";

export interface BuiltinImage {
  id: string;
  name: string;
  category: ImageAssetCategory;
  paint: () => string;
}

function makeImage(draw: (c: CanvasRenderingContext2D) => void): string {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  return canvas.toDataURL("image/png");
}

type Expression = "thuong" | "cuoi" | "ngac-nhien";

const EXPRESSION_LABEL: Record<Expression, string> = {
  thuong: "thường",
  cuoi: "cười",
  "ngac-nhien": "ngạc nhiên",
};

function characterPainter(
  shirt: string,
  shirtDark: string,
  hair: string,
  longHair: boolean,
  expr: Expression,
): () => string {
  return () =>
    makeImage((c) => {
      const cx = 480;
      // bóng chân
      c.fillStyle = "rgba(20,16,40,0.18)";
      c.beginPath();
      c.ellipse(cx, 472, 78, 13, 0, 0, Math.PI * 2);
      c.fill();
      // chân + giày
      c.fillStyle = "#3a3a4a";
      c.fillRect(cx - 35, 396, 25, 62);
      c.fillRect(cx + 10, 396, 25, 62);
      c.fillStyle = "#22222e";
      c.beginPath();
      c.roundRect(cx - 40, 454, 34, 13, 5);
      c.roundRect(cx + 6, 454, 34, 13, 5);
      c.fill();
      // thân áo (có mảng tối tạo khối) + tay
      c.fillStyle = shirt;
      c.beginPath();
      c.roundRect(cx - 54, 290, 108, 114, 18);
      c.fill();
      c.fillStyle = shirtDark;
      c.beginPath();
      c.roundRect(cx + 20, 290, 34, 114, 16);
      c.fill();
      c.fillStyle = shirt;
      c.fillRect(cx - 76, 298, 21, 90);
      c.fillRect(cx + 55, 298, 21, 90);
      c.fillStyle = "#f2c09a";
      c.beginPath();
      c.arc(cx - 66, 392, 9, 0, Math.PI * 2);
      c.arc(cx + 66, 392, 9, 0, Math.PI * 2);
      c.fill();
      // đầu
      c.fillStyle = "#f6c9a0";
      c.beginPath();
      c.arc(cx, 244, 37, 0, Math.PI * 2);
      c.fill();
      // má hồng
      c.fillStyle = "rgba(244,130,130,0.45)";
      c.beginPath();
      c.ellipse(cx - 21, 258, 8, 5, 0, 0, Math.PI * 2);
      c.ellipse(cx + 21, 258, 8, 5, 0, 0, Math.PI * 2);
      c.fill();
      // tóc + mảng sáng
      c.fillStyle = hair;
      c.beginPath();
      c.arc(cx, 236, 39, Math.PI, Math.PI * 2);
      c.fill();
      c.fillRect(cx - 39, 236, 78, 8);
      if (longHair) {
        c.fillRect(cx - 42, 236, 15, 80);
        c.fillRect(cx + 27, 236, 15, 80);
      }
      c.fillStyle = "rgba(255,255,255,0.20)";
      c.beginPath();
      c.ellipse(cx - 14, 216, 15, 6, -0.5, 0, Math.PI * 2);
      c.fill();
      // lông mày + mắt + miệng theo biểu cảm
      c.strokeStyle = "#3a2a20";
      c.lineWidth = 2.6;
      c.lineCap = "round";
      if (expr === "ngac-nhien") {
        c.beginPath();
        c.moveTo(cx - 20, 232);
        c.lineTo(cx - 7, 229);
        c.moveTo(cx + 7, 229);
        c.lineTo(cx + 20, 232);
        c.stroke();
        c.fillStyle = "#26262e";
        c.beginPath();
        c.arc(cx - 13, 247, 4.6, 0, Math.PI * 2);
        c.arc(cx + 13, 247, 4.6, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(cx, 264, 5.5, 7.5, 0, 0, Math.PI * 2);
        c.fill();
      } else if (expr === "cuoi") {
        c.beginPath();
        c.moveTo(cx - 20, 236);
        c.quadraticCurveTo(cx - 13, 231, cx - 6, 236);
        c.moveTo(cx + 6, 236);
        c.quadraticCurveTo(cx + 13, 231, cx + 20, 236);
        c.stroke();
        c.beginPath();
        c.moveTo(cx - 18, 248);
        c.quadraticCurveTo(cx - 13, 242, cx - 8, 248);
        c.moveTo(cx + 8, 248);
        c.quadraticCurveTo(cx + 13, 242, cx + 18, 248);
        c.stroke();
        c.fillStyle = "#8c4a3a";
        c.beginPath();
        c.ellipse(cx, 262, 10, 6.5, 0, 0, Math.PI);
        c.fill();
      } else {
        c.beginPath();
        c.moveTo(cx - 20, 235);
        c.lineTo(cx - 6, 235);
        c.moveTo(cx + 6, 235);
        c.lineTo(cx + 20, 235);
        c.stroke();
        c.fillStyle = "#26262e";
        c.beginPath();
        c.arc(cx - 13, 247, 3.8, 0, Math.PI * 2);
        c.arc(cx + 13, 247, 3.8, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx, 257, 9, 0.15 * Math.PI, 0.85 * Math.PI);
        c.stroke();
      }
    });
}

function bgClassroom(): string {
  return makeImage((c) => {
    c.fillStyle = "#f3e9d2";
    c.fillRect(0, 0, 960, 400);
    c.fillStyle = "#c9a876";
    c.fillRect(0, 400, 960, 140);
    c.strokeStyle = "rgba(120,90,50,0.25)";
    for (let x = 0; x <= 960; x += 80) {
      c.beginPath();
      c.moveTo(x, 400);
      c.lineTo(x - 40, 540);
      c.stroke();
    }
    // bảng
    c.fillStyle = "#2e4f43";
    c.beginPath();
    c.roundRect(300, 60, 380, 190, 8);
    c.fill();
    c.strokeStyle = "#8a6d4b";
    c.lineWidth = 10;
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.font = "600 30px sans-serif";
    c.textAlign = "center";
    c.fillText("Bài học hôm nay", 490, 130);
    c.font = "400 21px sans-serif";
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillText("a + b = ?", 490, 175);
    // đồng hồ + cửa sổ
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(150, 95, 34, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#4a4a55";
    c.lineWidth = 4;
    c.stroke();
    c.beginPath();
    c.moveTo(150, 95);
    c.lineTo(150, 74);
    c.moveTo(150, 95);
    c.lineTo(166, 102);
    c.stroke();
    const win = c.createLinearGradient(0, 60, 0, 260);
    win.addColorStop(0, "#bfe3ff");
    win.addColorStop(1, "#e8f7ff");
    c.fillStyle = win;
    c.fillRect(740, 60, 170, 200);
    c.strokeStyle = "#8a6d4b";
    c.lineWidth = 7;
    c.strokeRect(740, 60, 170, 200);
    c.beginPath();
    c.moveTo(825, 60);
    c.lineTo(825, 260);
    c.stroke();
    // bàn ghế tiền cảnh
    c.fillStyle = "#a9805a";
    for (const x of [90, 400, 710]) {
      c.beginPath();
      c.roundRect(x, 415, 170, 16, 5);
      c.fill();
      c.fillRect(x + 12, 431, 12, 60);
      c.fillRect(x + 146, 431, 12, 60);
    }
  });
}

function bgPark(): string {
  return makeImage((c) => {
    const sky = c.createLinearGradient(0, 0, 0, 340);
    sky.addColorStop(0, "#8ec9ee");
    sky.addColorStop(1, "#dff3ff");
    c.fillStyle = sky;
    c.fillRect(0, 0, 960, 340);
    c.fillStyle = "#6fbf5e";
    c.fillRect(0, 340, 960, 200);
    // lối đi
    c.fillStyle = "#d9c49a";
    c.beginPath();
    c.moveTo(430, 540);
    c.lineTo(505, 350);
    c.lineTo(545, 350);
    c.lineTo(640, 540);
    c.closePath();
    c.fill();
    // hồ
    c.fillStyle = "#7ec8e8";
    c.beginPath();
    c.ellipse(140, 445, 115, 42, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.beginPath();
    c.ellipse(105, 435, 34, 8, 0, 0, Math.PI * 2);
    c.fill();
    // cây nhiều lớp
    const tree = (x: number, y: number, s: number, tone: string) => {
      c.fillStyle = "#7a4a2b";
      c.fillRect(x - 6 * s, y, 12 * s, 52 * s);
      c.fillStyle = tone;
      for (const [dx, dy, r] of [[0, -28, 40], [-30, -8, 30], [30, -8, 30]] as const) {
        c.beginPath();
        c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        c.fill();
      }
    };
    tree(120, 330, 1.15, "#3f8f46");
    tree(835, 320, 1.3, "#357a3c");
    tree(650, 345, 0.85, "#4da653");
    tree(285, 350, 0.7, "#4da653");
    // ghế + đèn
    c.fillStyle = "#8a5a3a";
    c.fillRect(330, 428, 110, 10);
    c.fillRect(330, 402, 110, 8);
    c.fillRect(338, 438, 10, 26);
    c.fillRect(422, 438, 10, 26);
    c.fillStyle = "#3a3a4a";
    c.fillRect(742, 356, 7, 74);
    c.fillStyle = "#ffd94d";
    c.beginPath();
    c.arc(745, 348, 11, 0, Math.PI * 2);
    c.fill();
  });
}

function bgBeachSunset(): string {
  return makeImage((c) => {
    const sky = c.createLinearGradient(0, 0, 0, 330);
    sky.addColorStop(0, "#5b5ea6");
    sky.addColorStop(0.55, "#e8836b");
    sky.addColorStop(1, "#f7b267");
    c.fillStyle = sky;
    c.fillRect(0, 0, 960, 330);
    c.fillStyle = "#ffdf8a";
    c.beginPath();
    c.arc(480, 322, 52, 0, Math.PI * 2);
    c.fill();
    // biển + phản chiếu
    const sea = c.createLinearGradient(0, 330, 0, 450);
    sea.addColorStop(0, "#e8836b");
    sea.addColorStop(1, "#3f7fbf");
    c.fillStyle = sea;
    c.fillRect(0, 330, 960, 120);
    c.fillStyle = "rgba(255,223,138,0.55)";
    for (let i = 0; i < 16; i++) {
      const y = 340 + i * 7;
      const w = 90 - Math.abs(8 - i) * 7;
      c.fillRect(480 - w / 2 + Math.sin(i * 2.3) * 9, y, w, 3);
    }
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.fillRect(0, 446, 960, 5);
    // cát + dừa
    c.fillStyle = "#eed9a4";
    c.fillRect(0, 451, 960, 89);
    c.strokeStyle = "#6d5138";
    c.lineWidth = 13;
    c.beginPath();
    c.moveTo(862, 470);
    c.quadraticCurveTo(848, 400, 822, 356);
    c.stroke();
    c.strokeStyle = "#3f8f46";
    c.lineWidth = 8;
    for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
      c.beginPath();
      c.moveTo(822, 356);
      c.quadraticCurveTo(
        822 + Math.sin(a) * 62,
        330 - Math.cos(a) * 16,
        822 + Math.sin(a) * 104,
        356 - Math.cos(a) * 30 + 26,
      );
      c.stroke();
    }
  });
}

const CHARACTERS: Array<{
  base: string;
  shirt: string;
  dark: string;
  hair: string;
  longHair: boolean;
}> = [
  { base: "Linh", shirt: "#e85d75", dark: "#c44a5f", hair: "#4a2c1a", longHair: true },
  { base: "Hùng", shirt: "#3f7fbf", dark: "#33679c", hair: "#1c1c22", longHair: false },
];

export const BUILTIN_IMAGE_PACK: BuiltinImage[] = [
  ...CHARACTERS.flatMap((ch) =>
    (Object.keys(EXPRESSION_LABEL) as Expression[]).map((expr) => ({
      id: `pack-${ch.base}-${expr}`,
      name: `${ch.base} — ${EXPRESSION_LABEL[expr]}`,
      category: "character" as ImageAssetCategory,
      paint: characterPainter(ch.shirt, ch.dark, ch.hair, ch.longHair, expr),
    })),
  ),
  { id: "pack-bg-classroom", name: "Nền — Lớp học chi tiết", category: "background", paint: bgClassroom },
  { id: "pack-bg-park", name: "Nền — Công viên", category: "background", paint: bgPark },
  { id: "pack-bg-beach", name: "Nền — Biển hoàng hôn", category: "background", paint: bgBeachSunset },
];
