import React from 'react';
import {toRoman} from '../utils/analytics';

interface ClusterSymbolProps {
  cluster: number; // 1..6
  size?: number;
  showRoman?: boolean;
  className?: string;
}

export const CLUSTER_SHAPE_NAMES: Record<number, string> = {
  1: 'lingkaran hitam penuh',
  2: 'lingkaran kosong',
  3: 'persegi hitam penuh',
  4: 'segitiga kosong',
  5: 'belah ketupat arsir silang',
  6: 'persegi kosong berisi titik',
};

export const ClusterSymbol: React.FC<ClusterSymbolProps> = ({
  cluster,
  size = 16,
  showRoman = true,
  className = '',
}) => {
  const roman = toRoman(cluster);
  const shapeLabel = CLUSTER_SHAPE_NAMES[cluster] || `simbol klaster ${roman}`;
  const patternId = `crosshatch-klaster-${cluster}-${size}`;

  const renderShape = () => {
    switch (cluster) {
      case 1:
        // I = lingkaran hitam penuh
        return <circle cx="10" cy="10" r="7" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />;
      case 2:
        // II = lingkaran kosong
        return <circle cx="10" cy="10" r="7" fill="var(--paper)" stroke="currentColor" strokeWidth="1.8" />;
      case 3:
        // III = persegi hitam penuh
        return <rect x="3" y="3" width="14" height="14" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />;
      case 4:
        // IV = segitiga kosong
        return (
          <polygon
            points="10,2.5 17.5,16.5 2.5,16.5"
            fill="var(--paper)"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        );
      case 5:
        // V = belah ketupat arsir silang
        return (
          <>
            <defs>
              <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse">
                <path d="M 0,4 L 4,0 M -1,1 L 1,-1 M 3,5 L 5,3" stroke="currentColor" strokeWidth="1" />
                <path d="M 0,0 L 4,4 M -1,3 L 1,5 M 3,-1 L 5,1" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <polygon
              points="10,2 18,10 10,18 2,10"
              fill={`url(#${patternId})`}
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </>
        );
      case 6:
      default:
        // VI = persegi kosong berisi titik
        return (
          <>
            <rect x="3" y="3" width="14" height="14" fill="var(--paper)" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="10" cy="10" r="2.4" fill="currentColor" />
          </>
        );
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle ${className}`}
      role="img"
      aria-label={`Klaster ${roman} (${shapeLabel})`}
      title={`Klaster ${roman}: ${shapeLabel}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        className="shrink-0"
        aria-hidden="true"
      >
        {renderShape()}
      </svg>
      {showRoman && (
        <span className="font-mono-code font-semibold tabular-nums text-[0.9em]">{roman}</span>
      )}
    </span>
  );
};

// Pure HTML string generator for Leaflet divIcon markers
export function createLeafletMarkerHtml(cluster: number, isInverted = false): string {
  const roman = toRoman(cluster);
  const stroke = isInverted ? '#F2F2EE' : '#111111';
  const paper = isInverted ? '#111111' : '#FAFAF7';
  const shapeDesc = CLUSTER_SHAPE_NAMES[cluster] || `Klaster ${roman}`;

  let svgInner = '';
  switch (cluster) {
    case 1:
      svgInner = `<circle cx="10" cy="10" r="6.5" fill="${stroke}" stroke="${paper}" stroke-width="1.4" />`;
      break;
    case 2:
      svgInner = `<circle cx="10" cy="10" r="6.5" fill="${paper}" stroke="${stroke}" stroke-width="2" />`;
      break;
    case 3:
      svgInner = `<rect x="3.5" y="3.5" width="13" height="13" fill="${stroke}" stroke="${paper}" stroke-width="1.4" />`;
      break;
    case 4:
      svgInner = `<polygon points="10,2.5 17.5,16.5 2.5,16.5" fill="${paper}" stroke="${stroke}" stroke-width="2" />`;
      break;
    case 5:
      svgInner = `<polygon points="10,2 18,10 10,18 2,10" fill="${paper}" stroke="${stroke}" stroke-width="1.8" />
        <line x1="6" y1="6" x2="14" y2="14" stroke="${stroke}" stroke-width="1.2" />
        <line x1="14" y1="6" x2="6" y2="14" stroke="${stroke}" stroke-width="1.2" />`;
      break;
    default:
      svgInner = `<rect x="3.5" y="3.5" width="13" height="13" fill="${paper}" stroke="${stroke}" stroke-width="1.8" />
        <circle cx="10" cy="10" r="2.3" fill="${stroke}" />`;
      break;
  }

  return `<div role="img" aria-label="Simpul Klaster ${roman} (${shapeDesc})" style="display:flex;align-items:center;gap:2px;background:${paper};border:1px solid ${stroke};padding:1px 3px;line-height:1;">
    <svg width="14" height="14" viewBox="0 0 20 20" style="display:block;">${svgInner}</svg>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:${stroke};">${roman}</span>
  </div>`;
}
