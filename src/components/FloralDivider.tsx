import { DecorativeFlower } from "./Icons";

export function FloralDivider() {
  return (
    <div className="flex items-center justify-center gap-3 py-8">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-blush-200" />
      <DecorativeFlower className="w-4 h-4 text-blush-300" />
      <DecorativeFlower className="w-3 h-3 text-blush-200" />
      <DecorativeFlower className="w-4 h-4 text-blush-300" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-blush-200" />
    </div>
  );
}