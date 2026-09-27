import BackgroundFX from "./BackgroundFX";
import Hero from "./Hero";
import SiteHeader from "@/components/layout/SiteHeader";

type HomeScreenProps = {
  anonId: string | null;
};

export default function HomeScreen({ anonId }: HomeScreenProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-bg">
      <BackgroundFX />
      <SiteHeader anonId={anonId} />
      {/* pt clears the fixed nav bar (it ends 73px down). With pb, this
          puts the timer's top at 105px and the button's bottom 139px above
          the fold on the 1280×770 design, and keeps the pair centered as one
          group on taller screens. pb eases off on short ones. */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-[min(107px,14vh)] pt-[73px]">
        <Hero />
      </main>
    </div>
  );
}
