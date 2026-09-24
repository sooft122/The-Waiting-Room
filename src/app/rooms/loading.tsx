import RoomCardSkeleton from "@/components/skeletons/RoomCardSkeleton";

/** Shown instantly on navigation to /rooms while the real page's server-side
 * data (session, room list, joined ids) is still being fetched — so the nav
 * feels immediate instead of the browser sitting on the previous page. */
export default function Loading() {
  return (
    <div className="relative min-h-screen w-full bg-bg">
      <main className="relative z-10 mx-auto flex w-full max-w-[1214px] flex-col gap-10 px-5 pb-48 pt-[104px] sm:px-8 sm:pt-[112px] lg:px-0 lg:pt-[125px]">
        <div className="flex flex-col gap-3">
          <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-20 animate-pulse rounded-[17px] bg-white/5" />
            ))}
          </div>
        </div>

        <div className="h-[360px] w-full animate-pulse rounded-[20px] bg-white/5" />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <RoomCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
