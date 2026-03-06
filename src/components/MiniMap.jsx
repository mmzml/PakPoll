import { useRef, useEffect } from 'react';
import mapSvgString from '../assets/pakistan-map.svg?raw';

export default function MiniMap({ currentViewBox, origViewBox, fills }) {
  const svgContainerRef = useRef(null);

  // Apply party fills to the mini-map SVG whenever they change
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (!svg) return;
    if (!fills) {
      // Clear all fills back to default
      svg.querySelectorAll('path[id^="path"]').forEach(p => p.style.fill = '');
      return;
    }
    fills.forEach((color, pathId) => {
      const el = svg.getElementById(pathId);
      if (el) el.style.fill = color;
    });
  }, [fills]);

  if (!origViewBox) return null;

  const { x: ox, y: oy, w: ow, h: oh } = origViewBox;

  let rectStyle = null;
  if (currentViewBox) {
    const { x: cx, y: cy, w: cw, h: ch } = currentViewBox;
    rectStyle = {
      left:   `${((cx - ox) / ow) * 100}%`,
      top:    `${((cy - oy) / oh) * 100}%`,
      width:  `${(cw / ow) * 100}%`,
      height: `${(ch / oh) * 100}%`,
    };
  }

  return (
    <div className="mini-map">
      <div
        ref={svgContainerRef}
        className="mini-map-svg-wrap"
        dangerouslySetInnerHTML={{ __html: mapSvgString }}
      />
      {rectStyle && <div className="mini-map-viewport" style={rectStyle} />}
    </div>
  );
}
