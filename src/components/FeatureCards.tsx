import { NeedleIcon, ScissorsIcon, GridIcon, DecorativeFlower, ArrowRightIcon } from "./Icons";

const features = [
  {
    icon: NeedleIcon,
    title: "Pattern Designer",
    description: "Generate custom embroidery patterns with AI. Text-to-pattern, image-to-pattern, and full editing toolkit.",
    color: "from-blush-400 to-blush-500",
  },
  {
    icon: ScissorsIcon,
    title: "Collage Studio",
    description: "Compose beautiful fabric collages with textures, layers, and AI-assisted design tools.",
    color: "from-blush-300 to-blush-400",
  },
  {
    icon: GridIcon,
    title: "Quilt Block Studio",
    description: "Design traditional and modern quilt blocks with precision grid tools and pattern libraries.",
    color: "from-blush-500 to-blush-400",
  },
];

export function FeatureCards() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">
            Three Creative Tools
          </h2>
          <div className="mt-3 flex items-center justify-center gap-3 text-blush-300">
            <span className="h-px w-12 bg-blush-200" />
            <DecorativeFlower className="w-5 h-5" />
            <span className="h-px w-12 bg-blush-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group relative bg-white border border-blush-100 rounded-2xl p-6 shadow-petal hover:shadow-blush transition-all duration-300 hover:-translate-y-1"
            >
              {/* Decorative flower accent */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <DecorativeFlower className="w-4 h-4 text-blush-200" />
              </div>

              {/* Icon */}
              <div className="w-14 h-14 rounded-full bg-blush-50 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-blush-500" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                {feature.description}
              </p>

              {/* CTA */}
              <a
                href={`/app/${feature.title === "Pattern Designer" ? "designer" : feature.title === "Collage Studio" ? "collage" : "quilt-block"}`}
                className="inline-flex items-center gap-1.5 text-blush-600 font-semibold text-sm hover:text-blush-700 transition-colors"
              >
                Try Now
                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}