import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const rawName = process.argv.slice(2).join(" ").trim();

if (!rawName) {
  console.error('Usage: npm run game:new -- "Game Name"');
  process.exit(1);
}

const slug = rawName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const pascal = slug
  .split("-")
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");

const dir = path.join("src", "games", slug);

if (existsSync(dir)) {
  console.error(`Game folder already exists: ${dir}`);
  process.exit(1);
}

await mkdir(dir, { recursive: true });

await writeFile(
  path.join(dir, "brief.md"),
  `# ${rawName}\n\nReference mechanic:\n\nDistinct theme:\n\nCore loop:\n\nControls:\n\nWin/fail/restart:\n\nMobile notes:\n\nPolish checklist:\n\n- [ ] Start screen\n- [ ] Score/progress\n- [ ] Game over/restart\n- [ ] Mobile controls\n- [ ] Distinct visuals\n- [ ] Build passes\n`,
);

await writeFile(
  path.join(dir, `${pascal}.tsx`),
  `export function ${pascal}() {\n  return (\n    <section className=\"game-shell\">\n      <p>${rawName} scaffold created. Build the playable loop here.</p>\n    </section>\n  );\n}\n`,
);

console.log(`Created ${rawName} scaffold at ${dir}`);
