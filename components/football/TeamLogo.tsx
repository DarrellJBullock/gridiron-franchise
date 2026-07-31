import type { ReactNode } from "react";
import { getContrastColor, logoVariantFor, polygonPoints } from "@/lib/branding";

interface TeamLogoProps {
  seed: string;
  primaryColor: string;
  secondaryColor: string;
  abbreviation: string;
  size?: number;
  className?: string;
}

export function TeamLogo({ seed, primaryColor, secondaryColor, abbreviation, size = 44, className }: TeamLogoProps) {
  const variant = logoVariantFor(seed);
  const textColor = getContrastColor(primaryColor);
  const fontSize = abbreviation.length > 3 ? 26 : 32;

  let shape: ReactNode;
  switch (variant) {
    case 0: // Shield
      shape = (
        <path
          d="M50 4 L88 16 L88 50 Q88 82 50 96 Q12 82 12 50 L12 16 Z"
          fill={primaryColor}
          stroke={secondaryColor}
          strokeWidth={5}
        />
      );
      break;
    case 1: // Hexagon
      shape = <polygon points={polygonPoints(6, 46)} fill={primaryColor} stroke={secondaryColor} strokeWidth={5} />;
      break;
    case 2: // Ringed circle
      shape = (
        <>
          <circle cx={50} cy={50} r={46} fill={primaryColor} />
          <circle cx={50} cy={50} r={38} fill="none" stroke={secondaryColor} strokeWidth={5} />
        </>
      );
      break;
    case 3: // Diamond
      shape = (
        <polygon points={polygonPoints(4, 48, -90)} fill={primaryColor} stroke={secondaryColor} strokeWidth={5} />
      );
      break;
    case 4: // Pentagon
      shape = <polygon points={polygonPoints(5, 46)} fill={primaryColor} stroke={secondaryColor} strokeWidth={5} />;
      break;
    default: // Octagon
      shape = <polygon points={polygonPoints(8, 46)} fill={primaryColor} stroke={secondaryColor} strokeWidth={5} />;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${abbreviation} team logo`}
    >
      {shape}
      <text
        x={50}
        y={50}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={900}
        fill={textColor}
        fontFamily="var(--font-sans, sans-serif)"
      >
        {abbreviation}
      </text>
    </svg>
  );
}
