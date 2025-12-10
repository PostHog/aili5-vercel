interface PipeIconProps {
  className?: string;
  size?: number;
}

export function PipeIcon({ className, size = 40 }: PipeIconProps) {
  return (
    <svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 40 44"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top rim */}
      <rect
        x="4"
        y="2"
        width="32"
        height="8"
        rx="2"
        fill="currentColor"
        opacity="0.5"
      />
      <rect
        x="4"
        y="2"
        width="32"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />

      {/* Pipe body */}
      <rect
        x="8"
        y="10"
        width="24"
        height="24"
        fill="currentColor"
        opacity="0.3"
      />
      <rect
        x="8"
        y="10"
        width="24"
        height="24"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />

      {/* Bottom rim */}
      <rect
        x="4"
        y="34"
        width="32"
        height="8"
        rx="2"
        fill="currentColor"
        opacity="0.5"
      />
      <rect
        x="4"
        y="34"
        width="32"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />

      {/* Highlight line on pipe body */}
      <line
        x1="14"
        y1="12"
        x2="14"
        y2="32"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.4"
      />
      {/* Shadow line on pipe body */}
      <line
        x1="26"
        y1="12"
        x2="26"
        y2="32"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.2"
      />
    </svg>
  );
}
