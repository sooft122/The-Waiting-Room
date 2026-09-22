type CategoryFilterPillsProps = {
  categories: readonly string[];
  counts: Record<string, number>;
  active: string;
  onChange: (category: string) => void;
};

export default function CategoryFilterPills({
  categories,
  counts,
  active,
  onChange,
}: CategoryFilterPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-[7px]">
      {categories.map((category) => {
        const isActive = category === active;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={`shrink-0 whitespace-nowrap rounded-[17px] px-3 py-1.5 font-satoshi text-[14px] transition-colors ${
              isActive ? "text-black" : "bg-[#1d1d1d] text-[#d0d0d0] hover:bg-[#262626]"
            }`}
            style={
              isActive ? { backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)" } : undefined
            }
          >
            {category} ({counts[category] ?? 0})
          </button>
        );
      })}
    </div>
  );
}
