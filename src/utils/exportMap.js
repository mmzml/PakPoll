// Stroke styling normally comes from App.css, which a standalone SVG image doesn't see
const EXPORT_SVG_STYLE = '#pakistanMapSvg path[id^="path"] { stroke: #666; }';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// The area the site shows at default zoom. The SVG is displayed in its own width × height
// box, which is taller than its viewBox, so the visible area extends above and below the
// viewBox (and some map content, like the inset boxes, sits in that extra space).
function getDefaultView(svgMap, origViewBox) {
  const boxW = Number(svgMap.getAttribute('width')) || origViewBox.w;
  const boxH = Number(svgMap.getAttribute('height')) || origViewBox.h;
  const scale = Math.min(boxW / origViewBox.w, boxH / origViewBox.h);
  const w = boxW / scale;
  const h = boxH / scale;
  return {
    x: origViewBox.x - (w - origViewBox.w) / 2,
    y: origViewBox.y - (h - origViewBox.h) / 2,
    w,
    h,
  };
}

// Copy of the map for export: default zoom, no selection outline, and the border
// styling that normally comes from App.css
function cloneForExport(svgMap, view) {
  const clone = svgMap.cloneNode(true);
  clone.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  clone.querySelectorAll('.seat-selected').forEach(el => el.classList.remove('seat-selected'));
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = EXPORT_SVG_STYLE;
  clone.insertBefore(style, clone.firstChild);
  return clone;
}

// The default view has the same proportions as the SVG's width × height, so the copy
// keeps its original size attributes
export function exportMapSvg(svgMap, origViewBox) {
  const clone = cloneForExport(svgMap, getDefaultView(svgMap, origViewBox));
  return new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render map image'));
    img.src = url;
  });
}

// Render the map at default zoom (ignoring the current zoom) with a title and seat legend
export async function exportMapPng(svgMap, origViewBox, { title, subtitle, legend }) {
  const view = getDefaultView(svgMap, origViewBox);
  const SCALE = 2;
  const MAP_W = 1199;
  const MAP_H = Math.round(MAP_W * view.h / view.w);
  const PAD = 24;
  const HEADER_H = 70;
  const LEGEND_COLS = 6;
  const LEGEND_ROW_H = 26;
  const legendRows = Math.ceil(legend.length / LEGEND_COLS);
  const width = MAP_W + PAD * 2;
  const height = HEADER_H + MAP_H + PAD + legendRows * LEGEND_ROW_H + PAD;

  const clone = cloneForExport(svgMap, view);
  clone.setAttribute('width', MAP_W * SCALE);
  clone.setAttribute('height', MAP_H * SCALE);

  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#111111';
    ctx.font = 'bold 24px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(title, PAD, PAD + 20);
    ctx.fillStyle = '#555555';
    ctx.font = '15px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(subtitle, PAD, PAD + 42);

    ctx.drawImage(img, PAD, HEADER_H, MAP_W, MAP_H);

    const colW = MAP_W / LEGEND_COLS;
    const legendTop = HEADER_H + MAP_H + PAD;
    ctx.font = '14px system-ui, -apple-system, "Segoe UI", sans-serif';
    legend.forEach(({ name, color, count, change }, i) => {
      const x = PAD + (i % LEGEND_COLS) * colW;
      const y = legendTop + Math.floor(i / LEGEND_COLS) * LEGEND_ROW_H;
      ctx.fillStyle = `#${color}`;
      ctx.fillRect(x, y, 14, 14);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(x, y, 14, 14);
      ctx.fillStyle = '#111111';
      const changeText = change > 0 ? ` (+${change})` : change < 0 ? ` (${change})` : '';
      ctx.fillText(`${name} ${count}${changeText}`, x + 20, y + 12);
    });

    const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) throw new Error('Could not create PNG');
    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function csvField(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per constituency with every party's projected share. For the 2024 baseline
// (no projection yet) the projected columns would just repeat 2024, so they're dropped.
export function buildResultsCsv(constList, parties) {
  const isBaseline = constList[0]?.isBaseline;
  const header = isBaseline
    ? ['Constituency', 'Province', 'Winner 2024', 'Margin (pts)', ...parties.map(p => `${p} 2024 %`)]
    : ['Constituency', 'Province', 'Winner 2024', 'Projected winner', 'Margin (pts)', ...parties.map(p => `${p} %`)];
  const rows = constList.map(c => {
    const sorted = [...c.projectedPcts].sort((a, b) => b - a);
    const margin = (sorted[0] - (sorted[1] ?? 0)).toFixed(2);
    return [
      c.id, c.province, c.prevWinner,
      ...(isBaseline ? [] : [c.currWinner]),
      margin,
      ...c.projectedPcts.map(v => v.toFixed(2)),
    ];
  });
  // BOM so Excel opens the file as UTF-8
  return '﻿' + [header, ...rows].map(r => r.map(csvField).join(',')).join('\r\n');
}
