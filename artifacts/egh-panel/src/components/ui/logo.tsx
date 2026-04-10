/**
 * EGH Panel logo — icon mark + wordmark.
 *
 * Two variants:
 *   "full"    — stacked (icon over wordmark), used on login / setup screens
 *   "compact" — inline (icon beside wordmark), used in sidebar headers
 */

const BLUE = "hsl(214 91% 64%)";

function EghIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 36 36"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
    >
      {/* Rounded square container */}
      <rect
        x="1"
        y="1"
        width="34"
        height="34"
        rx="8"
        fill="hsl(214 91% 64% / 0.08)"
        stroke="hsl(214 91% 64% / 0.55)"
        strokeWidth="1.5"
      />

      {/* Bar 1 — full brightness */}
      <rect x="7" y="10" width="15" height="4" rx="2" fill={BLUE} />
      <circle cx="27" cy="12" r="2" fill={BLUE} />

      {/* Bar 2 — 65% */}
      <rect
        x="7"
        y="16"
        width="15"
        height="4"
        rx="2"
        fill={BLUE}
        opacity="0.65"
      />
      <circle cx="27" cy="18" r="2" fill={BLUE} opacity="0.65" />

      {/* Bar 3 — 35% */}
      <rect
        x="7"
        y="22"
        width="15"
        height="4"
        rx="2"
        fill={BLUE}
        opacity="0.35"
      />
      <circle cx="27" cy="24" r="2" fill={BLUE} opacity="0.35" />
    </svg>
  );
}

interface EghLogoProps {
  variant?: "full" | "compact";
  subtitle?: string;
}

export default function EghLogo({
  variant = "full",
  subtitle,
}: EghLogoProps) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2.5 select-none">
        <EghIcon size={28} />
        <div className="flex flex-col leading-none gap-0.5">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            EGH Panel
          </span>
          {subtitle && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    );
  }

  // full — stacked, for login / setup
  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <EghIcon size={44} />
      <div className="text-center space-y-1 leading-none">
        <p className="text-2xl font-bold tracking-tight text-foreground">
          EGH Panel
        </p>
        <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
          {subtitle ?? "Game Server Control Panel"}
        </p>
      </div>
    </div>
  );
}
