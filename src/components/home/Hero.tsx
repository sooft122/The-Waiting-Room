import PrimaryButton from "../ui/PrimaryButton";

export default function Hero() {
  return (
    <div className="relative z-10 flex w-full max-w-[515px] flex-col items-center gap-6 text-center">
      <div className="flex flex-col items-center gap-2.5 font-satoshi text-white">
        <h1
          className="animate-hero-in text-[clamp(2rem,6vw,4rem)] leading-[1.08]"
          style={{ animationDelay: "60ms" }}
        >
          Something worth <span className="italic">waiting</span> for.
        </h1>
        <p
          className="animate-hero-in max-w-[275px] font-inter text-[14px] leading-normal text-white/90"
          style={{ animationDelay: "200ms" }}
        >
          Join people around the world waiting for the same moment.
        </p>
      </div>
      <div className="animate-hero-in" style={{ animationDelay: "320ms" }}>
        <PrimaryButton
          href="/rooms"
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full" src="/icons/discover-circle.svg" />
          }
        >
          Discover Rooms
        </PrimaryButton>
      </div>
    </div>
  );
}
