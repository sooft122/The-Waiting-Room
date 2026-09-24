import RoomCardSkeleton from "@/components/skeletons/RoomCardSkeleton";

/** Shown instantly on navigation to /search while the real page's server-side
 * data is still being fetched. */
export default function Loading() {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-bg">
      <main className="relative z-10 flex flex-1 flex-col pb-40 pt-[73px]">
        <div className="mx-auto w-full max-w-[1214px] flex-1 px-5 pt-[28px] sm:px-8 lg:px-0">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <RoomCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
