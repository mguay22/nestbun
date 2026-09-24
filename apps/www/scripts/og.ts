/**
 * Renders public/og.png (1200×630) from an inline SVG with sharp.
 *   bun run og
 * Commit the PNG; it is served as the Open Graph / Twitter card image.
 */
import sharp from 'sharp';
import { resolve } from 'node:path';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#17181c"/>
  <circle cx="132" cy="140" r="44" fill="#fbf0df"/>
  <circle cx="132" cy="140" r="23" fill="#e0234e"/>
  <text x="200" y="158" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="52" font-weight="700" fill="#f5d6a3">nestbun</text>
  <text x="88" y="300" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">NestJS on Bun, natively.</text>
  <text x="88" y="372" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="34" fill="#c2c6d0">An HTTP adapter that runs your Nest app on Bun.serve().</text>
  <text x="88" y="422" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="34" fill="#c2c6d0">One-line swap. Faster than Express and Fastify.</text>
  <rect x="88" y="490" width="640" height="64" rx="12" fill="#23262f"/>
  <text x="112" y="532" font-family="Menlo, Consolas, monospace" font-size="28" fill="#f5d6a3">bun add @nestbun/platform</text>
  <text x="1112" y="590" text-anchor="end" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="26" fill="#9aa0ad">mguay22.github.io/nestbun</text>
</svg>`;

const out = resolve(import.meta.dirname, '..', 'public', 'og.png');
await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
