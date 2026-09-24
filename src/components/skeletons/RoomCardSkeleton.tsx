/** Placeholder shaped exactly like RoomCard (same size/radius), shown while
 * a room list is still loading so the grid doesn't jump when real cards
 * swap in. */
export default function RoomCardSkeleton() {
  return (
    <div className="h-[290px] w-full max-w-[296px] animate-pulse overflow-hidden rounded-[20px] border border-transparent bg-[#101113]">
      <div className="h-[207px] w-full bg-white/5" />
      <div className="flex flex-col gap-2 p-5">
        <div className="h-3 w-2/3 rounded bg-white/10" />
        <div className="h-3 w-1/3 rounded bg-white/5" />
      </div>
    </div>
  );
}
