import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Nav } from "~/components/Nav";
import { Footer } from "~/components/Footer";
import { FloralDivider } from "~/components/FloralDivider";

export const Route = createFileRoute("/showcase")({
  component: ShowcasePage,
});

// ── Types ──────────────────────────────────────────────
type ShowCategory = "all" | "embroidery" | "quilt-block" | "collage";

interface CommunityProject {
  id: number;
  title: string;
  creator: string;
  category: Exclude<ShowCategory, "all">;
  likes: number;
  comments: number;
  gradient: string; // CSS gradient for placeholder "photo"
  accent: string;
}

// ── Sample project data ────────────────────────────────
const DUMMY_PROJECTS: CommunityProject[] = [
  {
    id: 1,
    title: "Blossom Garden Hoop",
    creator: "Elena Vasquez",
    category: "embroidery",
    likes: 142,
    comments: 18,
    gradient: "from-pink-100 via-rose-50 to-blush-100",
    accent: "#ec4899",
  },
  {
    id: 2,
    title: "Starburst Baby Quilt",
    creator: "Marcus Chen",
    category: "quilt-block",
    likes: 237,
    comments: 42,
    gradient: "from-amber-100 via-yellow-50 to-orange-100",
    accent: "#f59e0b",
  },
  {
    id: 3,
    title: "Seaside Memory Collage",
    creator: "Lena Park",
    category: "collage",
    likes: 89,
    comments: 12,
    gradient: "from-cyan-100 via-teal-50 to-blue-100",
    accent: "#06b6d4",
  },
  {
    id: 4,
    title: "Victorian Rose Sampler",
    creator: "Sophie Laurent",
    category: "embroidery",
    likes: 315,
    comments: 56,
    gradient: "from-rose-100 via-pink-50 to-fuchsia-100",
    accent: "#e11d48",
  },
  {
    id: 5,
    title: "Autumn Log Cabin Throw",
    creator: "Sarah Kim",
    category: "quilt-block",
    likes: 178,
    comments: 24,
    gradient: "from-orange-100 via-amber-50 to-red-100",
    accent: "#f97316",
  },
  {
    id: 6,
    title: "Tropical Leaf Wrap",
    creator: "Lena Park",
    category: "collage",
    likes: 64,
    comments: 8,
    gradient: "from-emerald-100 via-green-50 to-lime-100",
    accent: "#10b981",
  },
];

const SHOW_CATEGORIES: { value: ShowCategory; label: string }[] = [
  { value: "all", label: "All Projects" },
  { value: "embroidery", label: "Embroidery" },
  { value: "quilt-block", label: "Quilt Blocks" },
  { value: "collage", label: "Collage" },
];

// ── Inline Components ──────────────────────────────────

function HeartIcon({ filled = false, className = "" }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CategoryBadge({ category }: { category: Exclude<ShowCategory, "all"> }) {
  const labels: Record<string, string> = {
    embroidery: "Embroidery",
    "quilt-block": "Quilt Block",
    collage: "Collage",
  };
  const colors: Record<string, string> = {
    embroidery: "bg-purple-50 text-purple-600",
    "quilt-block": "bg-amber-50 text-amber-600",
    collage: "bg-teal-50 text-teal-600",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${colors[category] || "bg-slate-50 text-slate-500"}`}>
      {labels[category] || category}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────
function ShowcasePage() {
  const [activeCategory, setActiveCategory] = useState<ShowCategory>("all");

  const filtered = DUMMY_PROJECTS.filter(
    (p) => activeCategory === "all" || p.category === activeCategory,
  );

  return (
    <div className="min-h-dvh">
      <Nav />
      <main>
        {/* Header */}
        <section className="py-20 text-center bg-gradient-to-b from-blush-50 to-white">
          <div className="max-w-3xl mx-auto px-6">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
              Community Showcase
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto font-body">
              See finished projects from the StitchWise community — embroidery pieces,
              quilt blocks, and collage quilts brought to life.
            </p>
          </div>
        </section>

        <FloralDivider />

        {/* Category Filters */}
        <section className="max-w-6xl mx-auto px-6 pb-8">
          <div className="flex flex-wrap gap-2">
            {SHOW_CATEGORIES.map((cat) => (
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
        </section>

        {/* Project Grid */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-blush hover:-translate-y-1 transition-all duration-300"
              >
                {/* Photo placeholder */}
                <div
                  className={`relative h-48 bg-gradient-to-br ${project.gradient} flex items-center justify-center overflow-hidden`}
                >
                  {/* Decorative stitch pattern overlay */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="w-full h-full floral-bg" />
                  </div>

                  {/* Simulated embroidery hoop / quilt block visual */}
                  <div className="relative z-10 flex flex-col items-center">
                    {/* Decorative circle */}
                    <div
                      className="w-20 h-20 rounded-full border-4 border-white/60 flex items-center justify-center mb-3 shadow-lg"
                      style={{ backgroundColor: `${project.accent}20` }}
                    >
                      <svg className="w-10 h-10 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        {project.category === "embroidery" ? (
                          <>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </>
                        ) : project.category === "quilt-block" ? (
                          <>
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="14" y="14" width="7" height="7" rx="1" />
                          </>
                        ) : (
                          <>
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                          </>
                        )}
                      </svg>
                    </div>
                  </div>

                  {/* Category badge overlay */}
                  <div className="absolute top-3 right-3">
                    <CategoryBadge category={project.category} />
                  </div>
                </div>

                {/* Project info */}
                <div className="p-5">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-blush-700 transition-colors mb-1">
                    {project.title}
                  </h3>
                  <p className="text-xs text-slate-400 font-body mb-3">
                    by {project.creator}
                  </p>

                  {/* Social actions */}
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-blush-500 transition-colors font-body">
                      <HeartIcon className="w-3.5 h-3.5" />
                      <span>{project.likes}</span>
                    </button>
                    <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-blush-500 transition-colors font-body">
                      <CommentIcon className="w-3.5 h-3.5" />
                      <span>{project.comments}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Submit Project CTA Card */}
            <div className="bg-gradient-to-br from-blush-500 to-blush-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-white shadow-blush min-h-[320px] hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-5 backdrop-blur-sm">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Share Your Creation</h3>
              <p className="text-sm text-white/80 font-body mb-6 max-w-[200px]">
                Finished a project? Submit it to be featured in the community showcase.
              </p>
              <a
                href="/app/submit-project"
                className="inline-flex items-center gap-2 bg-white text-blush-600 text-sm font-semibold px-5 py-2.5 rounded-full shadow-md hover:shadow-lg hover:bg-blush-50 transition-all"
              >
                Submit Your Project
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
