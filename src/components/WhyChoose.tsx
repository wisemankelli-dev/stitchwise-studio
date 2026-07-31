import { SparklesIcon, PaletteIcon, RulerIcon, HeartIcon, DecorativeFlower } from "./Icons";

const props = [
  {
    icon: SparklesIcon,
    title: "AI-Powered Generation",
    description: "Text-to-pattern & image-to-pattern — describe your vision and watch it come to life.",
  },
  {
    icon: PaletteIcon,
    title: "DMC Thread Mapping",
    description: "Real DMC color quantization ensures your digital pattern matches real thread colors.",
  },
  {
    icon: RulerIcon,
    title: "Professional-Grade Tools",
    description: "Export in .DST, .PES, and .EXP formats. Satin stitch, cross stitch, and more.",
  },
  {
    icon: HeartIcon,
    title: "Craft-First Design",
    description: "Made by crafters, for crafters. Every feature serves the stitching community.",
  },
];

export function WhyChoose() {
  return (
    <section className="py-20 bg-blush-50/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">
            Why Choose StitchWise
          </h2>
          <div className="mt-3 flex items-center justify-center gap-3 text-blush-300">
            <span className="h-px w-12 bg-blush-200" />
            <DecorativeFlower className="w-5 h-5" />
            <span className="h-px w-12 bg-blush-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {props.map((prop) => (
            <div
              key={prop.title}
              className="bg-white border border-blush-100 rounded-2xl p-6 shadow-petal hover:shadow-blush transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-full bg-blush-50 flex items-center justify-center mb-4">
                <prop.icon className="w-5 h-5 text-blush-500" />
              </div>
              <h3 className="font-bold text-slate-800 mb-2">
                {prop.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}