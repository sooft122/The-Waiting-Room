// The "Inner Main" layer's own fill: transparent in the middle, brightening
// toward the bottom and sides.
const INNER_MAIN_GRADIENT = `url("data:image/svg+xml;utf8,<svg viewBox='0 0 1624.2 1647' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(-2.0541e-13 243.05 -130.01 -1.7972e-13 812.08 -183)'><stop stop-color='rgba(0,0,0,0)' offset='0.7073'/><stop stop-color='rgba(64,64,64,0.25)' offset='0.75497'/><stop stop-color='rgba(128,128,128,0.5)' offset='0.80263'/><stop stop-color='rgba(191,191,191,0.75)' offset='0.8503'/><stop stop-color='rgba(255,255,255,1)' offset='0.89796'/></radialGradient></defs></svg>")`;

/**
 * Decorative backdrop — the Home design's "Inner Main" layer: a huge rounded
 * glass slab with soft highlights, at 5% opacity, anchored bottom-center.
 *
 * It keeps its design size (1624×1647) on smaller screens, and grows with the
 * viewport past the 1280px design width so its lit edges never come into
 * view as a hard line. For that, everything inside is proportional: positions
 * and sizes in % of the slab, strokes/blurs/radii in cqw (the slab is an
 * inline-size container).
 */
export default function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute bottom-[min(-82.03px,-6.4086vw)] left-1/2 aspect-[1624.153/1647.028] w-[max(1624.153px,126.887vw)] -translate-x-1/2 overflow-clip bg-[length:100%_100%] opacity-5 [container-type:inline-size]"
        style={{ backgroundImage: INNER_MAIN_GRADIENT }}
      >
        <div className="absolute left-[-21.1268%] top-[42.0139%] h-[82.9861%] w-[142.9577%] mix-blend-hard-light">
          <div className="absolute inset-[-47.45%_-27.93%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="block size-full max-w-none" src="/images/home/subtract.svg" />
          </div>
        </div>
        <div className="absolute left-[-26.0563%] top-[96.1806%] h-[26.0417%] w-[152.8169%] mix-blend-color-dodge">
          <div className="absolute inset-[-102.93%_-17.79%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="block size-full max-w-none" src="/images/home/highlights-1.svg" />
          </div>
        </div>
        <div className="absolute left-[-9.8592%] top-[82.2917%] h-[42.7083%] w-[120.4225%] mix-blend-plus-lighter">
          <div className="absolute inset-[-60%_-21.58%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="block size-full max-w-none" src="/images/home/highlights-2.svg" />
          </div>
        </div>
        <div className="absolute left-1/2 top-[23.264%] h-[154.8611%] w-[101.4084%] -translate-x-1/2 -translate-y-1/2 rounded-[29.5774cqw] border-[length:0.7042cqw] border-solid border-white">
          <div className="absolute inset-0 rounded-[29.5774cqw] bg-[rgba(0,0,0,0.01)]" />
          <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_0px_13.662cqw_-4.9296cqw_#dcdcdc]" />
        </div>
        <div className="absolute left-1/2 top-1/2 h-[101.3889%] w-[101.4084%] -translate-x-1/2 -translate-y-1/2 rounded-[29.5774cqw] border-[length:0.7042cqw] border-solid border-[#d9d9d9] mix-blend-hard-light blur-[1.4084cqw]" />
      </div>
    </div>
  );
}
