// The census of Kingsholm: npm run census (or: npx tsx tools/census.ts)
//   docs/census.csv   everyone in the city, one row each: who they are, where they live, where they spend the day
// Built from the areas as they are now (src/world/residents.ts), so rerun it whenever the streets change.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { residentsOf, type Resident } from "../src/world/residents.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const people = residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props });

const AREA = { capital: "Market Quarter", castle: "Castle", kingsroad: "King's Bridge" } as const;
const cell = (v: string | number | undefined) => {
  const s = v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const COLUMNS: [string, (r: Resident) => string | number | undefined][] = [
  ["id", r => r.id], ["name", r => r.name], ["sex", r => r.sex], ["age", r => r.age], ["job", r => r.job], ["role", r => r.role],
  ["family", r => r.family], ["traits", r => r.traits.join(", ")], ["quirk", r => r.quirk], ["stance", r => r.stance],
  ["home district", r => AREA[r.home.area]], ["home", r => r.home.place], ["home x", r => r.home.x], ["home y", r => r.home.y], ["floor", r => r.home.floor],
  ["by day", r => r.day.place], ["day district", r => AREA[r.day.area]], ["day x", r => r.day.x], ["day y", r => r.day.y],
  ["note", r => r.note],
];
const csv = [COLUMNS.map(([h]) => h).join(","), ...people.map(r => COLUMNS.map(([, get]) => cell(get(r))).join(","))].join("\n") + "\n";

mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(join(ROOT, "docs", "census.csv"), csv);
const count = (area: Resident["home"]["area"]) => people.filter(r => r.home.area === area).length;
console.log(`Census of Kingsholm: ${people.length} souls (${count("capital")} in the Market Quarter, ${count("castle")} at the Castle, ${count("kingsroad")} on the King's Bridge), written to docs/census.csv`);
