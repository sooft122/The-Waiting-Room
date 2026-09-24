import RoomCardSkeleton from "@/components/skeletons/RoomCardSkeleton";

/** Shown instantly on navigation to /profile while the real page's
 * server-side data (session, joined room ids, rooms) is still loading. */
export default function Loading() {
  return (
    <div className="relative min-h-screen w-full bg-bg">
      <main className="relative z-10 mx-auto flex w-full max-w-[1214px] flex-col gap-8 px-5 pb-24 pt-[104px] sm:px-8 sm:pt-[112px] lg:px-0 lg:pt-[125px]">
        <div className="flex items-center gap-4">
          <div className="size-20 animate-pulse rounded-full bg-white/10" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <RoomCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
