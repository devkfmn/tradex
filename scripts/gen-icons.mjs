import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");

const BG = "#0e1117";
const GREEN = "#22c55e";

// The brand mark (matches public/favicon.svg) drawn on a 32x32 grid.
const mark = `
  <path d="M6 21 L13 13 L18 17 L26 8" fill="none" stroke="${GREEN}"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="26" cy="8" r="2.2" fill="${GREEN}" />
`;

// "any" purpose icon: rounded-square dark background, full bleed.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${BG}" />
  ${mark}
</svg>`;

// maskable icon: solid full-bleed background (no rounding) with the mark
// shrunk into the centered ~80% safe zone so adaptive masks never clip it.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${BG}" />
  <g transform="translate(16 16) scale(0.66) translate(-16 -16)">
    ${mark}
  </g>
</svg>`;

const targets = [
  { svg: iconSvg, size: 192, out: "pwa-192x192.png" },
  { svg: iconSvg, size: 512, out: "pwa-512x512.png" },
  { svg: maskableSvg, size: 512, out: "pwa-maskable-512x512.png" },
  { svg: maskableSvg, size: 180, out: "apple-touch-icon.png" },
];

for (const { svg, size, out } of targets) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(resolve(publicDir, out));
  console.log(`wrote public/${out} (${size}x${size})`);
}
