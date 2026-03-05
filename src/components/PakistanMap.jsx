import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import mapSvgString from '../assets/pakistan-map.svg?raw';

const PakistanMap = forwardRef(function PakistanMap(props, ref) {
  const containerRef = useRef(null);

  // Expose the inner SVG element to parent via ref
  useImperativeHandle(ref, () => ({
    getSvg() {
      return containerRef.current?.querySelector('svg');
    }
  }));

  // Pan & zoom setup after SVG is injected
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svgMap = container.querySelector('svg');
    if (!svgMap) return;

    let viewBox = { x: 0, y: 0, h: svgMap.clientHeight, w: svgMap.clientWidth };
    svgMap.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    const svgSize = { w: svgMap.clientWidth, h: svgMap.clientHeight };
    let isPanning = false;
    let startPoint = { x: 0, y: 0 };
    let scale = 1;

    function onWheel(e) {
      e.preventDefault();
      const w = viewBox.w;
      const h = viewBox.h;
      const mx = e.offsetX;
      const my = e.offsetY;
      const dw = w * Math.sign(-e.deltaY) * 0.05;
      const dh = h * Math.sign(-e.deltaY) * 0.05;
      const dx = dw * mx / svgSize.w;
      const dy = dh * my / svgSize.h;
      viewBox = { x: viewBox.x + dx, y: viewBox.y + dy, w: viewBox.w - dw, h: viewBox.h - dh };
      scale = svgSize.w / viewBox.w;
      svgMap.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
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
    }

    function onMouseUp(e) {
      if (!isPanning) return;
      const endPoint = { x: e.x, y: e.y };
      const dx = (startPoint.x - endPoint.x) / scale;
      const dy = (startPoint.y - endPoint.y) / scale;
      viewBox = { x: viewBox.x + dx, y: viewBox.y + dy, w: viewBox.w, h: viewBox.h };
      svgMap.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
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
});

export default PakistanMap;
