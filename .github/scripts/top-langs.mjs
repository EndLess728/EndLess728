// Builds assets/top-langs.svg from the languages of EndLess728's public, non-fork repos.
// Runs in GitHub Actions with the default GITHUB_TOKEN. No dependencies.
import { writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.GH_USER || "EndLess728";
const TOKEN = process.env.GITHUB_TOKEN;
const TOP = 8;
const EXCLUDE = new Set(["HTML", "CSS", "SCSS", "Makefile", "Batchfile", "Shell", "Starlark", "Procfile", "Dockerfile"]);

const COLORS = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Swift: "#F05138", Kotlin: "#A97BFF",
  Java: "#b07219", "Objective-C": "#438eff", "Objective-C++": "#6866fb", Ruby: "#701516",
  Python: "#3572A5", Dart: "#00B4AB", Go: "#00ADD8", Rust: "#dea584", "C++": "#f34b7d",
  C: "#555555", "C#": "#178600", PHP: "#4F5D95", Vue: "#41b883", Svelte: "#ff3e00",
  CMake: "#DA3434", Groovy: "#4298b8", MDX: "#fcb32c",
};
const FALLBACK = ["#fe428e", "#a9fef7", "#f8d847", "#7aa2f7", "#9ece6a", "#ff9e64", "#bb9af7", "#2ac3de"];

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function collect() {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/users/${USER}/repos?type=owner&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const totals = {};
  for (const r of repos) {
    if (r.fork || r.archived) continue;
    const langs = await gh(`/repos/${r.full_name}/languages`);
    for (const [lang, bytes] of Object.entries(langs)) {
      if (EXCLUDE.has(lang)) continue;
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }
  return totals;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function render(totals) {
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, TOP);
  const sum = sorted.reduce((n, [, b]) => n + b, 0) || 1;
  const items = sorted.map(([name, bytes], i) => ({
    name,
    pct: (bytes / sum) * 100,
    color: COLORS[name] || FALLBACK[i % FALLBACK.length],
  }));

  const W = 350, H = 165, PAD = 25, BAR_W = W - PAD * 2;
  let x = PAD;
  const bar = items.map((it) => {
    const w = (it.pct / 100) * BAR_W;
    const r = `<rect x="${x.toFixed(2)}" y="60" width="${w.toFixed(2)}" height="8" fill="${it.color}"/>`;
    x += w;
    return r;
  }).join("");

  const legend = items.map((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = PAD + col * 150, ly = 100 + row * 20;
    return `<g transform="translate(${lx},${ly})"><circle cx="5" cy="-4" r="5" fill="${it.color}"/><text x="15" y="0" class="lang">${esc(it.name)} ${it.pct.toFixed(1)}%</text></g>`;
  }).join("");

  // Grow height if there are many rows
  const rows = Math.ceil(items.length / 2);
  const height = Math.max(H, 100 + rows * 20 + 5);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" role="img" aria-label="Most used languages">
<style>
  .title{font:600 18px 'Segoe UI',Ubuntu,Sans-Serif;fill:#fe428e}
  .lang{font:400 11px 'Segoe UI',Ubuntu,Sans-Serif;fill:#a9fef7}
</style>
<rect x="0.5" y="0.5" rx="4.5" width="${W - 1}" height="${height - 1}" fill="#141321"/>
<text x="${PAD}" y="35" class="title">Most Used Languages</text>
<mask id="m"><rect x="${PAD}" y="60" width="${BAR_W}" height="8" rx="5" fill="#fff"/></mask>
<g mask="url(#m)">${bar}</g>
${legend}
</svg>
`;
}

if (process.argv[2] !== "--test") {
  const totals = await collect();
  mkdirSync("assets", { recursive: true });
  writeFileSync("assets/top-langs.svg", render(totals));
  console.log("Wrote assets/top-langs.svg", totals);
}
