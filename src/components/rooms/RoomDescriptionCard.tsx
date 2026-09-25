type RoomDescriptionCardProps = {
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
};

export default function RoomDescriptionCard({
  description,
  ctaText,
  ctaLink,
}: RoomDescriptionCardProps) {
  return (
    <div className="flex min-h-[179px] w-full flex-col overflow-hidden rounded-[20px] bg-[#08090b]">
      <div className="flex h-[50px] w-full shrink-0 items-center bg-[#101113] px-[17px]">
        <h2 className="font-figtree text-[14px] text-white">Room’s Description</h2>
      </div>

      {description ? (
        <div className="flex flex-col items-start gap-[18px] p-[17px]">
          <p className="whitespace-pre-wrap font-figtree text-[14px] leading-[1.2] text-white/70">
            {description}
          </p>
          {ctaText && ctaLink ? (
            <a
              href={ctaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex w-fit flex-col items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)]"
            >
              <span className="relative flex items-center gap-1 overflow-hidden rounded-[9px] px-[30px] py-2">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-[9px]"
                  style={{
                    backgroundImage:
                      "linear-gradient(180.55deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                  }}
                />
                <span className="relative font-figtree text-[12px] font-medium text-black">
                  {ctaText}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="relative size-[14px]" src="/icons/link-square-01.svg" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
                />
              </span>
            </a>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-[17px]">
          <p className="max-w-[271px] text-center font-satoshi text-[20px] text-white">
            Sorry, this room doesn’t have any description.
          </p>
        </div>
      )}
    </div>
  );
}
