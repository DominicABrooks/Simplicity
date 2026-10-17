// The itch.io upload: npm run build:itch (the build into dist-itch/, then this)
//   dist-itch.zip   the game, index.html at the top, every path in it relative: itch serves it from an address of its
//                   own, not GitHub Pages' /Simplicity/, so that build (npm run build) won't do there.
// A plain zip, written here so the upload needs nothing installed: each file deflated, with its CRC and the directory.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FROM = join(ROOT, "dist-itch"), TO = join(ROOT, "dist-itch.zip");

/** Every file under `dir`, source maps left out (nobody needs them on itch). */
function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesIn(path) : name.endsWith(".map") ? [] : [path];
  });
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const locals: Buffer[] = [], central: Buffer[] = [];
let offset = 0;
const files = filesIn(FROM);
if (!files.some(f => relative(FROM, f) === "index.html")) throw new Error("No dist-itch/index.html: run npm run build:itch");
for (const path of files) {
  const name = Buffer.from(relative(FROM, path).split(sep).join("/")), raw = readFileSync(path), packed = deflateRawSync(raw, { level: 9 });
  const crc = crc32(raw);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0, 8); entry.writeUInt16LE(8, 10);
  entry.writeUInt32LE(0, 12); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(raw.length, 24);
  entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
  locals.push(local, name, packed);
  central.push(entry, name);
  offset += local.length + name.length + packed.length;
}
const dir = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...locals, dir, end]);
writeFileSync(TO, zip);
console.log(`dist-itch.zip: ${files.length} files, ${(zip.length / 1024).toFixed(0)} KB. Upload it to itch.io as an HTML game.`);
