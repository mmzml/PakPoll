import SeatDetails from './SeatDetails';

export default function Tooltip({ tooltip }) {
  if (!tooltip.visible) return null;

  const { x, y } = tooltip;

  const W = 230;
  const H = 220;
  const OFFSET = 16;
  let left = x + OFFSET;
  let top = y + OFFSET;
  if (left + W > window.innerWidth - 10) left = x - OFFSET - W;
  if (top + H > window.innerHeight - 10) top = y - OFFSET - H;

  return (
    <div className="map-tooltip" style={{ left, top }}>
      <SeatDetails seat={tooltip} />
    </div>
  );
}
