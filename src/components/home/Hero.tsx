import PrimaryButton from "../ui/PrimaryButton";
import HeroTimer from "./HeroTimer";

export default function Hero() {
  return (
    <div className="relative z-10 flex w-full flex-col items-center">
      {/* Its own wrapper, since the entrance animation also animates filter,
          which would override the timer's blur. */}
      <div className="animate-hero-in mb-[21px]">
        <HeroTimer renderedAt={Date.now()} />
      </div>

      <div className="flex w-full max-w-[515px] flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-2.5 font-satoshi font-medium text-white">
          <h1
            className="animate-hero-in text-[clamp(2rem,6vw,4rem)] leading-[1.08] text-white/50"
            style={{ animationDelay: "60ms" }}
          >
            Something worth <span className="italic text-white">waiting</span> for.
          </h1>
          <p
            className="animate-hero-in max-w-[275px] text-[14px] leading-[normal]"
            style={{ animationDelay: "200ms" }}
          >
            Join people around the world waiting for the same moment.
          </p>
        </div>
        <div className="animate-hero-in" style={{ animationDelay: "320ms" }}>
          <PrimaryButton
            href="/rooms"
            size="large"
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-full" src="/icons/discover-circle.svg" />
            }
          >
            Discover Rooms
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
