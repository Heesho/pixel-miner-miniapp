"use client";

type CoreIconProps = {
  className?: string;
  size?: number;
};

export function CoreIcon({ className, size = 12 }: CoreIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      {/* Main square */}
      <rect x="3" y="3" width="6" height="6" fill="currentColor" />
      {/* Bottom-left - attached to corner */}
      <rect x="1" y="9" width="2" height="2" fill="currentColor" />
      {/* Top-right - attached to corner */}
      <rect x="9" y="1" width="2" height="2" fill="currentColor" />
    </svg>
  );
}
