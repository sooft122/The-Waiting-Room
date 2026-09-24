import Link from "next/link";
import type { CSSProperties } from "react";

export type BreadcrumbItem = { label: string; href?: string };

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
  style?: CSSProperties;
};

/** "Discover Rooms > Room Name" style trail — the same treatment already
 * used on the "view all" room section pages, now shared everywhere else
 * too instead of being reimplemented per page. The current (last) item
 * truncates on its own, so a long room name can't blow out the layout. */
export default function Breadcrumbs({ items, className, style }: BreadcrumbsProps) {
  return (
    <div className={`flex min-w-0 items-center gap-0.5 ${className ?? ""}`} style={style}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={i} className="flex min-w-0 items-center gap-0.5">
            {i > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-5 shrink-0" src="/icons/arrow-right-01.svg" />
            ) : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="shrink-0 font-satoshi text-[14px] text-[#d0d0d0] opacity-65 transition-opacity hover:opacity-100"
              >
                {item.label}
              </Link>
            ) : (
              <span className="min-w-0 truncate font-satoshi text-[14px] text-white">
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
