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
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-[8vh] pt-10 sm:pb-[10vh]">
        <Hero />
      </main>
    </div>
  );
}
