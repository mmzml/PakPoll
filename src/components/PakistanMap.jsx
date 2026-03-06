import { useRef, useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import mapSvgString from '../assets/pakistan-map.svg?raw';

const PakistanMap = memo(forwardRef(function PakistanMap(props, ref) {
  const containerRef = useRef(null);
  const viewBoxCallbackRef = useRef(null);
  const viewBoxStateRef = useRef(null);  // committed viewBox { x, y, w, h }
  const origViewBoxRef = useRef(null);   // original full viewBox
  const svgRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getSvg() {
      return containerRef.current?.querySelector('svg');
    },
    subscribeViewBox(cb) {
      viewBoxCallbackRef.current = cb;
    },
    getOrigViewBox() {
      return origViewBoxRef.current ? { ...origViewBoxRef.current } : null;
    },
    resetZoom() {
      const svgMap = svgRef.current;
      const orig = origViewBoxRef.current;
      if (!svgMap || !orig) return;
      const newVB = { ...orig };
      viewBoxStateRef.current = newVB;
      svgMap.setAttribute('viewBox', `${newVB.x} ${newVB.y} ${newVB.w} ${newVB.h}`);
      viewBoxCallbackRef.current?.(newVB);
    },
    zoomBy(factor) {
      const svgMap = svgRef.current;
      const vb = viewBoxStateRef.current;
      const orig = origViewBoxRef.current;
      if (!svgMap || !vb || !orig) return;
      const new_w = vb.w * factor;
      const new_h = vb.h * factor;
      if (new_w > orig.w * 1.5) return;   // max zoom out: 1.5× original
      if (new_w < orig.w / 50) return;    // max zoom in: 50× original
      const newVB = {
        x: vb.x + (vb.w - new_w) / 2,
        y: vb.y + (vb.h - new_h) / 2,
        w: new_w,
        h: new_h,
      };
      viewBoxStateRef.current = newVB;
      svgMap.setAttribute('viewBox', `${newVB.x} ${newVB.y} ${newVB.w} ${newVB.h}`);
      viewBoxCallbackRef.current?.(newVB);
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svgMap = container.querySelector('svg');
    if (!svgMap) return;
    svgRef.current = svgMap;

    const vb = svgMap.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    let viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    origViewBoxRef.current = { ...viewBox };
    viewBoxStateRef.current = { ...viewBox };

    const svgSize = { w: svgMap.clientWidth, h: svgMap.clientHeight };
    let isPanning = false;
    let startPoint = { x: 0, y: 0 };
    let scale = 1;

    function applyVB(newVB) {
      viewBox = newVB;
      viewBoxStateRef.current = newVB;
      svgMap.setAttribute('viewBox', `${newVB.x} ${newVB.y} ${newVB.w} ${newVB.h}`);
      viewBoxCallbackRef.current?.(newVB);
    }

    function onWheel(e) {
      e.preventDefault();
      const dw = viewBox.w * Math.sign(-e.deltaY) * 0.05;
      const dh = viewBox.h * Math.sign(-e.deltaY) * 0.05;
      const dx = dw * e.offsetX / svgSize.w;
      const dy = dh * e.offsetY / svgSize.h;
      applyVB({ x: viewBox.x + dx, y: viewBox.y + dy, w: viewBox.w - dw, h: viewBox.h - dh });
      scale = svgSize.w / viewBox.w;
    }

    function onMouseDown(e) {
      isPanning = true;
      startPoint = { x: e.x, y: e.y };
    }

    function onMouseMove(e) {
      if (!isPanning) return;
      const endPoint = { x: e.x, y: e.y };
      const dx = (startPoint.x - endPoint.x) / scale;
      const dy = (startPoint.y - endPoint.y) / scale;
      const moved = { x: viewBox.x + dx, y: viewBox.y + dy, w: viewBox.w, h: viewBox.h };
      svgMap.setAttribute('viewBox', `${moved.x} ${moved.y} ${moved.w} ${moved.h}`);
      viewBoxCallbackRef.current?.(moved); // keep mini-map in sync during drag
    }

    function onMouseUp(e) {
      if (!isPanning) return;
      const endPoint = { x: e.x, y: e.y };
      const dx = (startPoint.x - endPoint.x) / scale;
      const dy = (startPoint.y - endPoint.y) / scale;
      applyVB({ x: viewBox.x + dx, y: viewBox.y + dy, w: viewBox.w, h: viewBox.h });
      isPanning = false;
    }

    function onMouseLeave() {
      isPanning = false;
    }

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseLeave);

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <div
      className="map-viewer"
      id="mapViewer"
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: mapSvgString }}
    />
  );
}));

export default PakistanMap;
