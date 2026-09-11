/** TEMP scratch: positive control cross-check teddy4 (5″) at 42 vs 70. Deleted after use. */
import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { imageBufferToStitchGrid } from "../domain/stitch/patternConverter";

function cv(h: string | null | undefined): [number, number, number] | null {
  if (!h || !h.startsWith("#") || h.length !== 7) return null;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const isDark = (h: string | null | undefined) => { const v = cv(h); return v !== null && Math.max(...v) < 110; };
const isBg = (h: string | null | undefined) => {
  const v = cv(h);
  if (!v) return true;
  const mx = Math.max(...v), mn = Math.min(...v);
  return mx >= 190 && (mx - mn) / mx <= 0.2;
};
function compsInRows(g: any[][], rowMax: number): number[] {
  const n = g.length;
  const seen = new Set<string>();
  const out: number[] = [];
  const dfs = (r: number, c: number): number => {
    if (r < 0 || r >= n || c < 0 || c >= n || seen.has(r + "," + c) || !isDark(g[r]?.[c]?.color)) return 0;
    seen.add(r + "," + c);
    let s = 1;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) s += dfs(r + dr, c + dc);
    return s;
  };
  for (let r = 0; r < Math.min(rowMax, n); r++) for (let c = 0; c < n; c++) {
    if (isDark(g[r]?.[c]?.color) && !seen.has(r + "," + c)) out.push(dfs(r, c));
  }
  return out;
}

describe("teddy4 control", () => {
  it("42 vs 70 form", async () => {
    const src = readFileSync("/home/team/shared/ornament-busy/teddy4-source.png");
    for (const [dim, op] of [[70, true], [42, true]] as const) {
      const res = await imageBufferToStitchGrid(Buffer.from(src), dim, 21, { width: dim, height: dim }, { outlinePreserve: op });
      const n = res.grid.length;
      let subj = 0, dark = 0;
      const rowsWithSubj: number[] = [];
      const ascii: string[] = [];
      for (let r = 0; r < n; r++) {
        let line = "";
        let any = false;
        for (let c = 0; c < n; c++) {
          const h = res.grid[r][c]?.color;
          if (h && !isBg(h)) { any = true; subj++; if (isDark(h)) { dark++; line += "#"; } else line += "."; }
          else line += " ";
        }
        if (any) rowsWithSubj.push(r);
        ascii.push(line.trim().length ? `r${String(r).padStart(2, "0")} ${line}` : `r${String(r).padStart(2, "0")} (blank)`);
      }
      const topComps = compsInRows(res.grid, Math.floor(n * 0.3));
      console.log(`=== ${dim}×${dim} subject=${subj} fill=${(subj / (n * n) * 100).toFixed(0)}% dark=${dark} rows ${rowsWithSubj[0]}..${rowsWithSubj[rowsWithSubj.length - 1]} topComp(≥3): [${topComps.filter(s => s >= 3).join(",")}]`);
      console.log(ascii.slice(0, Math.max(14, Math.floor(n * 0.22))).join("\n"));
    }
    expect(true).toBe(true);
  });
});