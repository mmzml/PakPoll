import { useMemo } from 'react';

const CX = 75, CY = 75, OUTER = 68, INNER = 44;

function arcPath(startAngle, endAngle) {
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  const cos = Math.cos, sin = Math.sin;
  return [
    `M ${CX + OUTER * cos(startAngle)} ${CY + OUTER * sin(startAngle)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${CX + OUTER * cos(endAngle)} ${CY + OUTER * sin(endAngle)}`,
    `L ${CX + INNER * cos(endAngle)} ${CY + INNER * sin(endAngle)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${CX + INNER * cos(startAngle)} ${CY + INNER * sin(startAngle)}`,
    'Z',
  ].join(' ');
}

export default function DonutChart({ seats, parties, partyColors }) {
  const total = seats.reduce((s, v) => s + v, 0);
  const majority = Math.floor(total / 2) + 1;

  const slices = useMemo(() => {
    const items = parties
      .map((name, i) => ({ name, color: partyColors[i], count: seats[i] }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count);

    let cumAngle = -Math.PI / 2; // start from top
    return items.map(item => {
      const sweep = (item.count / total) * 2 * Math.PI;
      const start = cumAngle;
      cumAngle += sweep;
      return { ...item, startAngle: start, endAngle: cumAngle };
    });
  }, [seats, parties, partyColors, total]);

  return (
    <div className="donut-container">
      <div className="donut-svg-wrap">
        <svg width="150" height="150" viewBox="0 0 150 150">
          {total === 0 ? (
            <circle cx={CX} cy={CY} r={OUTER} fill="#eee" />
          ) : slices.length === 1 ? (
            // Single party: draw two semicircles to avoid degenerate arc
            <>
              <path d={arcPath(-Math.PI / 2, Math.PI / 2)} fill={`#${slices[0].color}`} />
              <path d={arcPath(Math.PI / 2, 3 * Math.PI / 2)} fill={`#${slices[0].color}`} />
            </>
          ) : (
            slices.map(s => (
              <path
                key={s.name}
                d={arcPath(s.startAngle, s.endAngle)}
                fill={`#${s.color}`}
                stroke="white"
                strokeWidth="1.5"
              />
            ))
          )}
          {/* Donut hole labels */}
          <text x={CX} y={CY - 7} textAnchor="middle" fontSize="15" fontWeight="bold" fill="currentColor">
            {total}
          </text>
          <text x={CX} y={CY + 8} textAnchor="middle" fontSize="9" fill="currentColor">
            seats
          </text>
          <text x={CX} y={CY + 22} textAnchor="middle" fontSize="8" fill="#888">
            maj: {majority}
          </text>
        </svg>
      </div>

      <div className="donut-legend">
        {slices.map(({ name, color, count }) => (
          <div key={name} className="donut-legend-item">
            <span className="legend-dot" style={{ background: `#${color}` }} />
            <span className="donut-legend-name">{name}</span>
            <span className="donut-legend-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
