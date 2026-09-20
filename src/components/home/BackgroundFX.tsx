import Image from "next/image";
import heroGlassComposite from "../../../public/images/hero-glass-composite.jpg";

/**
 * Decorative, non-interactive backdrop. Figma's native "Glass" effect
 * (refraction/dispersion/frost on the design's vertical Glass Container) is a
 * render-engine feature with no CSS equivalent and doesn't survive the
 * design-to-code export — every attempt to rebuild it from primitives read
 * as an approximation, not the real thing. This uses the actual rendered
 * export straight from Figma instead, at the design frame's own aspect
 * ratio, scaled to cover the viewport.
 */
export default function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Image
        alt=""
        src={heroGlassComposite}
        fill
        sizes="100vw"
        className="object-cover"
        priority
      />
    </div>
  );
}
