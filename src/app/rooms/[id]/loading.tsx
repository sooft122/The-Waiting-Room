/** Shown instantly on navigation to a room page while the real page's
 * server-side data (room, session, mood/energy/analytics) is still loading —
 * roughly mirrors RoomDetailScreen's hero + content shape to avoid a jarring
 * swap once the real content arrives. */
export default function Loading() {
  return (
    <div className="relative min-h-screen w-full bg-bg">
      <div className="relative h-[90vh] w-full animate-pulse overflow-hidden bg-white/5">
        <div className="absolute inset-0 mx-auto w-full max-w-[1214px] px-5 sm:px-8 lg:px-0">
          <div className="absolute bottom-4 left-0 flex max-w-[calc(100%-16px)] flex-col gap-4 sm:bottom-9 sm:gap-[25px] lg:bottom-[100px]">
            <div className="h-7 w-64 rounded bg-white/10" />
            <div className="h-4 w-40 rounded bg-white/5" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1214px] flex-col gap-5 px-5 py-10 sm:px-8 lg:px-0">
        <div className="h-32 w-full animate-pulse rounded-[20px] bg-white/5" />
        <div className="h-48 w-full animate-pulse rounded-[20px] bg-white/5" />
      </div>
    </div>
  );
}
