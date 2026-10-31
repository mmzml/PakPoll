import { useRef, memo } from 'react';
import mapSvgString from '../assets/pakistan-map.svg?raw';
import { useMapStyles } from '../hooks/useMapStyles';

// Shared object so React doesn't re-insert the SVG on every render (see PakistanMap)
const mapMarkup = { __html: mapSvgString };

// memo: the mini-map only re-renders when the view or styling changes, and the
// injected SVG markup is never re-parsed
const MiniMap = memo(function MiniMap({ currentViewBox, origViewBox, fills, fallbackFill, hiddenIds }) {
  const svgContainerRef = useRef(null);
  useMapStyles(svgContainerRef, { fills, fallbackFill, hiddenIds });

  let rectStyle = null;
  if (origViewBox && currentViewBox) {
    const { x: ox, y: oy, w: ow, h: oh } = origViewBox;
    const { x: cx, y: cy, w: cw, h: ch } = currentViewBox;
    rectStyle = {
      left:   `${((cx - ox) / ow) * 100}%`,
      top:    `${((cy - oy) / oh) * 100}%`,
      width:  `${(cw / ow) * 100}%`,
      height: `${(ch / oh) * 100}%`,
    };
  }

  // Stay mounted (hidden) until the main map reports its viewBox, so the styling
  // hook always has an SVG to work on
  return (
    <div className="mini-map" hidden={!origViewBox}>
      <div
        ref={svgContainerRef}
        className="mini-map-svg-wrap"
        dangerouslySetInnerHTML={mapMarkup}
      />
      {rectStyle && <div className="mini-map-viewport" style={rectStyle} />}
    </div>
  );
});

export default MiniMap;
