import { useRef, useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import mapSvgString from '../assets/pakistan-map.svg?raw';
import { useMapStyles } from '../hooks/useMapStyles';

// Must be a single shared object: React 19 compares dangerouslySetInnerHTML by object
// identity, so a new { __html } on each render would replace the whole SVG and
// orphan every listener and ref pointing at the old one.
const mapMarkup = { __html: mapSvgString };

// Styling comes in as props (fills, hiddenIds, selectedId); seat interaction goes
// out through onSeatHover(pathId | null, event) and onSeatClick(pathId).
const PakistanMap = memo(forwardRef(function PakistanMap(
  { fills, fallbackFill, hiddenIds, selectedId, onSeatHover, onSeatClick },
  ref,
) {
  const containerRef = useRef(null);
  const viewBoxCallbackRef = useRef(null);
  const viewBoxStateRef = useRef(null);  // committed viewBox { x, y, w, h }
  const origViewBoxRef = useRef(null);   // original full viewBox
  const svgRef = useRef(null);
  const handlersRef = useRef({});

  useMapStyles(containerRef, { fills, fallbackFill, hiddenIds, selectedId });

  // Listeners are attached once; read the latest callbacks through a ref
  useEffect(() => {
    handlersRef.current = { onSeatHover, onSeatClick };
  });

  useEffect(() => {
    const svgMap = containerRef.current?.querySelector('svg');
    if (!svgMap) return;
    let down = null;

    function onPointerMove(e) {
      // Touch and pen use tap-to-pin instead; a hover tooltip would get stuck on screen
      const hovering = e.pointerType === 'mouse' && !(e.buttons & 1) && e.target.tagName === 'path';
      handlersRef.current.onSeatHover?.(hovering ? e.target.id : null, e);
    }
    function onPointerLeave(e) {
      handlersRef.current.onSeatHover?.(null, e);
    }
    function onPointerDown(e) {
      down = { x: e.clientX, y: e.clientY };
    }
    // Ignore clicks that end a drag-to-pan
    function onClick(e) {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      if (e.target.tagName === 'path') handlersRef.current.onSeatClick?.(e.target.id);
    }

    svgMap.addEventListener('pointermove', onPointerMove);
    svgMap.addEventListener('pointerleave', onPointerLeave);
    svgMap.addEventListener('pointerdown', onPointerDown);
    svgMap.addEventListener('click', onClick);
    return () => {
      svgMap.removeEventListener('pointermove', onPointerMove);
      svgMap.removeEventListener('pointerleave', onPointerLeave);
      svgMap.removeEventListener('pointerdown', onPointerDown);
      svgMap.removeEventListener('click', onClick);
    };
  }, []);

  // Commit a new viewBox. Pan/zoom handlers and the buttons below all read from
  // viewBoxStateRef, so they always start from the latest view.
  function commitViewBox(newVB) {
    const svgMap = svgRef.current;
    if (!svgMap) return;
    viewBoxStateRef.current = newVB;
    svgMap.setAttribute('viewBox', `${newVB.x} ${newVB.y} ${newVB.w} ${newVB.h}`);
    viewBoxCallbackRef.current?.(newVB);
  }

  useImperativeHandle(ref, () => ({
    getSvg() {
      return containerRef.current?.querySelector('svg');
    },
    hasElement(id) {
      return !!svgRef.current?.getElementById(id);
    },
    subscribeViewBox(cb) {
      viewBoxCallbackRef.current = cb;
    },
    getOrigViewBox() {
      return origViewBoxRef.current ? { ...origViewBoxRef.current } : null;
    },
    resetZoom() {
      const orig = origViewBoxRef.current;
      if (!orig) return;
      commitViewBox({ ...orig });
    },
    zoomBy(factor) {
      const vb = viewBoxStateRef.current;
      const orig = origViewBoxRef.current;
      if (!vb || !orig) return;
      const new_w = vb.w * factor;
      const new_h = vb.h * factor;
      if (new_w > orig.w * 1.5) return;   // max zoom out: 1.5× original
      if (new_w < orig.w / 50) return;    // max zoom in: 50× original
      commitViewBox({
        x: vb.x + (vb.w - new_w) / 2,
        y: vb.y + (vb.h - new_h) / 2,
        w: new_w,
        h: new_h,
      });
    },
    // Centre the view on an element, sized so it fills roughly a third of the map
    zoomToElement(id) {
      const el = svgRef.current?.getElementById(id);
      const orig = origViewBoxRef.current;
      if (!el || !orig) return;
      const box = el.getBBox();
      const aspect = orig.h / orig.w;
      const w = Math.min(orig.w, Math.max(orig.w / 50, box.width * 3, (box.height * 3) / aspect));
      const h = w * aspect;
      commitViewBox({
        x: box.x + box.width / 2 - w / 2,
        y: box.y + box.height / 2 - h / 2,
        w,
        h,
      });
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svgMap = container.querySelector('svg');
    if (!svgMap) return;
    svgRef.current = svgMap;

    const vb = svgMap.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    origViewBoxRef.current = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    viewBoxStateRef.current = { ...origViewBoxRef.current };

    const svgSize = { w: svgMap.clientWidth, h: svgMap.clientHeight };
    let isPanning = false;
    let startPoint = { x: 0, y: 0 };
    const view = () => viewBoxStateRef.current;
    const scale = () => svgSize.w / view().w;

    function pannedBy(clientX, clientY) {
      const vb = view();
      return {
        x: vb.x + (startPoint.x - clientX) / scale(),
        y: vb.y + (startPoint.y - clientY) / scale(),
        w: vb.w,
        h: vb.h,
      };
    }

    // Show a pan in progress without committing it
    function previewViewBox(moved) {
      svgMap.setAttribute('viewBox', `${moved.x} ${moved.y} ${moved.w} ${moved.h}`);
      viewBoxCallbackRef.current?.(moved); // keep mini-map in sync during drag
    }

    function onWheel(e) {
      e.preventDefault();
      const vb = view();
      const dw = vb.w * Math.sign(-e.deltaY) * 0.05;
      const dh = vb.h * Math.sign(-e.deltaY) * 0.05;
      const dx = dw * e.offsetX / svgSize.w;
      const dy = dh * e.offsetY / svgSize.h;
      commitViewBox({ x: vb.x + dx, y: vb.y + dy, w: vb.w - dw, h: vb.h - dh });
    }

    function onMouseDown(e) {
      isPanning = true;
      startPoint = { x: e.x, y: e.y };
    }

    function onMouseMove(e) {
      if (!isPanning) return;
      previewViewBox(pannedBy(e.x, e.y));
    }

    function onMouseUp(e) {
      if (!isPanning) return;
      commitViewBox(pannedBy(e.x, e.y));
      isPanning = false;
    }

    function onMouseLeave(e) {
      if (isPanning) commitViewBox(pannedBy(e.x, e.y));
      isPanning = false;
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      isPanning = true;
      startPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    function onTouchMove(e) {
      if (!isPanning || e.touches.length !== 1) return;
      e.preventDefault();
      previewViewBox(pannedBy(e.touches[0].clientX, e.touches[0].clientY));
    }

    function onTouchEnd(e) {
      if (!isPanning) return;
      isPanning = false;
      if (e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        commitViewBox(pannedBy(t.clientX, t.clientY));
      }
    }

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseLeave);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div
      className="map-viewer"
      id="mapViewer"
      ref={containerRef}
      dangerouslySetInnerHTML={mapMarkup}
    />
  );
}));

export default PakistanMap;
