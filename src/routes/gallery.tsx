import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Nav } from "~/components/Nav";
import { Footer } from "~/components/Footer";
import { FloralDivider } from "~/components/FloralDivider";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
});

// ── Types ──────────────────────────────────────────────
type Category = "all" | "embroidery" | "quilt-block" | "collage";

interface SamplePattern {
  id: number;
  title: string;
  category: Exclude<Category, "all">;
  designer: string;
  colors: string[];
  grid: number[][]; // small 8×8 pixel grid for thumbnail
}

// ── Sample pattern data ────────────────────────────────
const DUMMY_PATTERNS: SamplePattern[] = [
  {
    id: 1,
    title: "Sunflower Meadow",
    category: "embroidery",
    designer: "Elena Vasquez",
    colors: ["#f59e0b", "#d97706", "#65a30d", "#e2e8f0"],
    grid: [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 3, 1, 1, 3, 1, 0],
      [1, 1, 1, 2, 2, 1, 1, 1],
      [1, 1, 1, 2, 2, 1, 1, 1],
      [0, 1, 3, 1, 1, 3, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ],
  },
  {
    id: 2,
    title: "Geometric Stars",
    category: "quilt-block",
    designer: "Marcus Chen",
    colors: ["#8b5cf6", "#ec4899", "#3b82f6", "#f8fafc"],
    grid: [
      [1, 0, 0, 0, 0, 0, 0, 1],
      [0, 2, 0, 0, 0, 0, 2, 0],
      [0, 0, 3, 0, 0, 3, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 3, 0, 0, 3, 0, 0],
      [0, 2, 0, 0, 0, 0, 2, 0],
      [1, 0, 0, 0, 0, 0, 0, 1],
    ],
  },
  {
    id: 3,
    title: "Vintage Roses",
    category: "embroidery",
    designer: "Sophie Laurent",
    colors: ["#ef4444", "#ec4899", "#e11d48", "#fef3c7"],
    grid: [
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 2, 2, 2, 2, 1, 1],
      [1, 2, 3, 2, 2, 3, 2, 1],
      [1, 2, 2, 3, 3, 2, 2, 1],
      [1, 2, 2, 3, 3, 2, 2, 1],
      [1, 2, 3, 2, 2, 3, 2, 1],
      [1, 1, 2, 2, 2, 2, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
    ],
  },
  {
    id: 4,
    title: "Coastal Collage",
    category: "collage",
    designer: "Lena Park",
    colors: ["#06b6d4", "#14b8a6", "#e2e8f0", "#cbd5e1"],
    grid: [
      [3, 3, 3, 0, 0, 0, 1, 1],
      [3, 3, 0, 0, 2, 0, 0, 1],
      [3, 0, 0, 2, 2, 2, 0, 0],
      [0, 0, 2, 2, 2, 2, 2, 0],
      [0, 0, 2, 2, 2, 2, 2, 0],
      [3, 0, 0, 2, 2, 2, 0, 0],
      [3, 3, 0, 0, 2, 0, 0, 1],
      [3, 3, 3, 0, 0, 0, 1, 1],
    ],
  },
  {
    id: 5,
    title: "Autumn Leaves",
    category: "embroidery",
    designer: "Elena Vasquez",
    colors: ["#f97316", "#d97706", "#b45309", "#fef3c7"],
    grid: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 3, 3, 3, 3, 1, 0],
      [1, 3, 3, 2, 2, 3, 3, 1],
      [1, 3, 2, 1, 1, 2, 3, 1],
      [1, 3, 2, 1, 1, 2, 3, 1],
      [1, 3, 3, 2, 2, 3, 3, 1],
      [0, 1, 3, 3, 3, 3, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
    ],
  },
  {
    id: 6,
    title: "Modern Chevron",
    category: "quilt-block",
    designer: "Marcus Chen",
    colors: ["#6366f1", "#a855f7", "#c084fc", "#f8fafc"],
    grid: [
      [4, 4, 4, 1, 1, 2, 2, 2],
      [4, 4, 1, 1, 2, 2, 3, 3],
      [4, 1, 1, 2, 2, 3, 3, 2],
      [1, 1, 2, 2, 3, 3, 2, 2],
      [1, 1, 2, 2, 3, 3, 2, 2],
      [4, 1, 1, 2, 2, 3, 3, 2],
      [4, 4, 1, 1, 2, 2, 3, 3],
      [4, 4, 4, 1, 1, 2, 2, 2],
    ],
  },
  {
    id: 7,
    title: "Tropical Paradise",
    category: "collage",
    designer: "Lena Park",
    colors: ["#22c55e", "#16a34a", "#86efac", "#ecfdf5"],
    grid: [
      [0, 0, 0, 2, 2, 0, 0, 0],
      [0, 0, 2, 2, 2, 2, 0, 0],
      [0, 2, 2, 3, 3, 2, 2, 0],
      [2, 2, 3, 1, 1, 3, 2, 2],
      [2, 2, 3, 1, 1, 3, 2, 2],
      [0, 2, 2, 3, 3, 2, 2, 0],
      [0, 0, 2, 2, 2, 2, 0, 0],
      [0, 0, 0, 2, 2, 0, 0, 0],
    ],
  },
  {
    id: 8,
    title: "Winter Snowflake",
    category: "embroidery",
    designer: "Sophie Laurent",
    colors: ["#93c5fd", "#bfdbfe", "#dbeafe", "#f8fafc"],
    grid: [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 2, 3, 3, 2, 0, 0],
      [0, 2, 3, 1, 1, 3, 2, 0],
      [1, 3, 1, 2, 2, 1, 3, 1],
      [1, 3, 1, 2, 2, 1, 3, 1],
      [0, 2, 3, 1, 1, 3, 2, 0],
      [0, 0, 2, 3, 3, 2, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ],
  },
  {
    id: 9,
    title: "Log Cabin Square",
    category: "quilt-block",
    designer: "Sarah Kim",
    colors: ["#ef4444", "#f97316", "#eab308", "#f8fafc"],
    grid: [
      [1, 1, 1, 1, 2, 2, 2, 2],
      [1, 3, 3, 3, 3, 3, 3, 2],
      [1, 3, 1, 1, 2, 2, 3, 2],
      [1, 3, 1, 3, 3, 2, 3, 2],
      [1, 3, 1, 3, 3, 2, 3, 2],
      [1, 3, 1, 1, 2, 2, 3, 2],
      [1, 3, 3, 3, 3, 3, 3, 2],
      [1, 1, 1, 1, 2, 2, 2, 2],
    ],
  },
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "All Patterns" },
  { value: "embroidery", label: "Embroidery" },
  { value: "quilt-block", label: "Quilt Blocks" },
  { value: "collage", label: "Collage" },
];

// ── Inline Components ──────────────────────────────────

function PixelThumbnail({ pattern, size = 80 }: { pattern: SamplePattern; size?: number }) {
  const cellSize = size / pattern.grid.length;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${pattern.grid.length} ${pattern.grid.length}`}
      className="rounded-lg overflow-hidden"
      style={{ imageRendering: "pixelated" }}
    >
      {pattern.grid.map((row, r) =>
        row.map((colorIdx, c) =>
          colorIdx > 0 ? (
            <rect
              key={`${r}-${c}`}
              x={c}
              y={r}
              width={1}
              height={1}
              fill={pattern.colors[colorIdx - 1] || "#e2e8f0"}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CategoryBadge({ category }: { category: Exclude<Category, "all"> }) {
  const labels: Record<string, string> = {
    embroidery: "Embroidery",
    "quilt-block": "Quilt Block",
    collage: "Collage",
  };
  const bgColors: Record<string, string> = {
    embroidery: "bg-purple-50 text-purple-600",
    "quilt-block": "bg-amber-50 text-amber-600",
    collage: "bg-teal-50 text-teal-600",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${bgColors[category] || "bg-slate-50 text-slate-500"}`}>
      {labels[category] || category}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────
function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = DUMMY_PATTERNS.filter((p) => {
    const matchesCat = activeCategory === "all" || p.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.designer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-dvh">
      <Nav />
      <main>
        {/* Header */}
        <section className="py-20 text-center bg-gradient-to-b from-blush-50 to-white">
          <div className="max-w-3xl mx-auto px-6">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
              Pattern Gallery
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto font-body">
              Browse beautiful embroidery, quilt block, and collage patterns created by
              the StitchWise community.
            </p>
          </div>
        </section>

        <FloralDivider />

        {/* Filters & Search */}
        <section className="max-w-7xl mx-auto px-6 pb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setActiveCategory(cat.value)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 font-body ${
                    activeCategory === cat.value
                      ? "bg-blush-500 text-white shadow-md shadow-blush-500/25"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-blush-300 hover:bg-blush-50 hover:text-blush-600"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Bar (placeholder) */}
            <div className="relative w-full sm:w-64">
              <SearchIcon />
              <div className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-300">
                {/* icon positioned via padding */ ""}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patterns…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blush-400/40 focus:border-blush-400 transition font-body"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </div>
            </div>
          </div>
        </section>

        {/* Pattern Grid */}
        <section className="max-w-7xl mx-auto px-6 pb-24">
          {filtered.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blush-50 flex items-center justify-center">
                <GridIcon />
                <div className="text-blush-300">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">No patterns found</h3>
              <p className="text-slate-500 text-sm font-body">
                {searchQuery
                  ? `No results for "${searchQuery}". Try a different search term or category.`
                  : "No patterns in this category yet. Check back soon!"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((pattern) => (
                  <a
                    key={pattern.id}
                    href={`/designer`}
                    className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-blush hover:-translate-y-1 transition-all duration-300"
                  >
                    {/* Thumbnail */}
                    <div className="relative bg-gradient-to-br from-blush-50 to-purple-50 p-6 flex items-center justify-center">
                      <div className="w-28 h-28">
                        <PixelThumbnail pattern={pattern} size={112} />
                      </div>
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-blush-500/0 group-hover:bg-blush-500/5 transition-colors duration-300 flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white text-blush-600 text-xs font-semibold px-4 py-2 rounded-full shadow-md">
                          View Pattern
                        </span>
                      </div>
                    </div>

                    {/* Card info */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-bold text-slate-800 group-hover:text-blush-700 transition-colors line-clamp-1">
                          {pattern.title}
                        </h3>
                        <CategoryBadge category={pattern.category} />
                      </div>
                      <p className="text-xs text-slate-400 font-body">
                        by {pattern.designer}
                      </p>
                    </div>
                  </a>
                ))}

                {/* "Explore More" teaser card */}
                <div className="bg-gradient-to-br from-blush-50 to-white rounded-2xl border-2 border-dashed border-blush-200 p-8 flex flex-col items-center justify-center text-center min-h-[260px] hover:border-blush-300 hover:bg-blush-50/50 transition-all duration-300">
                  <div className="w-14 h-14 rounded-full bg-blush-100 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-blush-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 mb-1">More Coming Soon</h3>
                  <p className="text-xs text-slate-400 font-body mb-4">
                    New patterns added weekly from our growing community.
                  </p>
                  <a
                    href="/designer"
                    className="text-xs font-semibold text-blush-600 hover:text-blush-700 transition-colors"
                  >
                    Create your own →
                  </a>
                </div>
              </div>

              {/* Pagination placeholder */}
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  disabled
                  className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="w-10 h-10 rounded-lg bg-blush-500 text-white text-sm font-semibold flex items-center justify-center shadow-sm">
                  1
                </span>
                <span className="w-10 h-10 rounded-lg text-sm text-slate-400 flex items-center justify-center font-body">
                  2
                </span>
                <span className="w-10 h-10 rounded-lg text-sm text-slate-400 flex items-center justify-center font-body">
                  3
                </span>
                <span className="px-2 text-slate-300">…</span>
                <button
                  disabled
                  className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
