interface Props {
  on: boolean;
  name: string;
  onToggle: () => void;
  className?: string;
}

export default function Star({ on, name, onToggle, className }: Props) {
  return (
    <button
      type="button"
      className={`star${on ? " star--on" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={on}
      aria-label={
        on ? `Remove ${name} from shortlist` : `Add ${name} to shortlist`
      }
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.2l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.2l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7L12 3.2z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
