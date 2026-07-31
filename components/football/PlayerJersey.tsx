import { getContrastColor } from "@/lib/branding";

interface PlayerJerseyProps {
  primaryColor: string;
  secondaryColor: string;
  number: number;
  size?: number;
  className?: string;
}

export function PlayerJersey({ primaryColor, secondaryColor, number, size = 56, className }: PlayerJerseyProps) {
  const textColor = getContrastColor(primaryColor);
  const fontSize = number >= 10 ? 30 : 34;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Jersey number ${number}`}
    >
      <path
        d="M35 8 L65 8 L65 17 L84 22 L93 46 L77 52 L71 32 L71 95 L29 95 L29 32 L23 52 L7 46 L16 22 L35 17 Z"
        fill={primaryColor}
        stroke={secondaryColor}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M42 8 L50 22 L58 8" fill="none" stroke={secondaryColor} strokeWidth={3} strokeLinejoin="round" />
      <rect x={23} y={44} width={8} height={10} fill={secondaryColor} />
      <rect x={69} y={44} width={8} height={10} fill={secondaryColor} />
      <text
        x={50}
        y={62}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={900}
        fill={textColor}
        fontFamily="var(--font-sans, sans-serif)"
      >
        {number}
      </text>
    </svg>
  );
}
