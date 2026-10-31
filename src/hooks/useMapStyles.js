import { useEffect } from 'react';

// Apply React-owned styling to a map SVG that was injected as raw markup.
// Both the main map and the mini-map use this, so they always match.
//   fills:       Map of path id → colour. When set, every other path gets fallbackFill.
//                When null, the colours baked into the SVG file are left alone.
//   hiddenIds:   Set of element ids to hide.
//   selectedId:  path id to outline.
export function useMapStyles(containerRef, { fills, fallbackFill, hiddenIds, selectedId }) {
  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg || !fills) return;
    svg.querySelectorAll('path[id^="path"]').forEach(path => {
      path.style.fill = fills.get(path.id) ?? fallbackFill;
    });
  }, [containerRef, fills, fallbackFill]);

  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg || !hiddenIds) return;
    const els = [...hiddenIds].map(id => svg.getElementById(id)).filter(Boolean);
    els.forEach(el => { el.style.visibility = 'hidden'; });
    return () => els.forEach(el => { el.style.visibility = ''; });
  }, [containerRef, hiddenIds]);

  useEffect(() => {
    const el = selectedId && containerRef.current?.querySelector('svg')?.getElementById(selectedId);
    if (!el) return;
    el.classList.add('seat-selected');
    return () => el.classList.remove('seat-selected');
  }, [containerRef, selectedId]);
}
