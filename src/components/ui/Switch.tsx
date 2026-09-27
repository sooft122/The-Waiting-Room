type SwitchProps = {
  checked: boolean;
  onClick: () => void;
  id?: string;
  disabled?: boolean;
  /** Accessible name — or point labelledBy at visible text instead. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
};

/** On/off switch: a light track with a dark knob when on (the same light
 * finish as the primary buttons), a dim track with a light knob when off. */
export default function Switch({ checked, onClick, id, disabled, label, labelledBy, describedBy }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-5 w-[34px] shrink-0 rounded-full transition-colors duration-200 disabled:cursor-default disabled:opacity-50 ${
        checked ? "bg-[#dcdcdc]" : "bg-white/15"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0.5 top-0.5 size-4 rounded-full transition-[transform,background-color] duration-200 ${
          checked ? "translate-x-[14px] bg-[#18191b]" : "translate-x-0 bg-white/80"
        }`}
      />
    </button>
  );
}
