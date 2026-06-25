// 깨! PWA 아이콘 생성 — public/icons/icon.svg 를 PNG 로 래스터화.
// 실행: node scripts/make-icons.js   (sharp devDependency 필요)
// 아이콘 디자인을 바꾸려면 icon.svg 만 수정 후 재실행.
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const svg = await readFile(join(dir, "icon.svg"));

// 알이 이미 안전영역(중앙 ~60%) 안에 있어 normal/maskable 동일 소스 사용.
const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(svg, { density: 384 }).resize(t.size, t.size).png().toFile(join(dir, t.name));
  console.log("wrote", t.name);
}
console.log("done");
