import { SparklesIcon, HeartIcon, DecorativeFlower } from "./Icons";

const steps = [
  {
    number: 1,
    title: "Imagine",
    description: "Dream up your perfect pattern — a floral embroidery, a collage quilt, or a geometric block.",
    icon: HeartIcon,
  },
  {
    number: 2,
    title: "Generate",
    description: "Use AI to bring your vision to life. Text-to-pattern or image-to-pattern in seconds.",
    icon: SparklesIcon,
  },
  {
    number: 3,
    title: "Refine",
    description: "Tweak every detail with professional editing tools. Colors, stitches, fabrics — all adjustable.",
    icon: null,
  },
  {
    number: 4,
    title: "Stitch",
    description: "Export to your machine and bring your creation to life, stitch by stitch.",
    icon: null,
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">
            How It Works
          </h2>
          <div className="mt-3 flex items-center justify-center gap-3 text-blush-300">
            <span className="h-px w-12 bg-blush-200" />
            <DecorativeFlower className="w-5 h-5" />
            <span className="h-px w-12 bg-blush-200" />
          </div>
        </div>

        {/* Desktop: horizontal layout */}
        <div className="hidden md:flex items-start justify-between gap-8">
          {steps.map((step, i) => (
            <>
              <div key={step.number} className="flex-1 text-center">
                <div className="w-14 h-14 rounded-full bg-blush-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blush-200/50">
                  <span className="text-white font-bold text-lg">{step.number}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:flex items-center pt-7">
                  <svg width="32" height="2" viewBox="0 0 32 2" fill="none">
                    <line x1="0" y1="1" x2="32" y2="1" stroke="#fbcfe8" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                </div>
              )}
            </>
          ))}
        </div>

        {/* Mobile: vertical layout */}
        <div className="md:hidden space-y-8">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blush-500 flex items-center justify-center shadow-md shadow-blush-200/50">
                <span className="text-white font-bold">{step.number}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 mb-1">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}