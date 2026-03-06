export default function Tooltip({ tooltip }) {
  if (!tooltip.visible) return null;

  const { x, y, id, province, prevWinner, prevWinnerColor, currWinner, currWinnerColor, partyData } = tooltip;

  const W = 230;
  const H = 220;
  const OFFSET = 16;
  let left = x + OFFSET;
  let top = y + OFFSET;
  if (left + W > window.innerWidth - 10) left = x - OFFSET - W;
  if (top + H > window.innerHeight - 10) top = y - OFFSET - H;

  return (
    <div className="map-tooltip" style={{ left, top }}>
      <div className="tooltip-title">{id} — {province}</div>
      <div className="tooltip-prev-winner">
        Prev. winner:{' '}
        <span style={{ color: `#${prevWinnerColor}`, fontWeight: 'bold' }}>{prevWinner}</span>
      </div>
      <div className="tooltip-curr-winner">
        Proj. winner:{' '}
        <span style={{ color: `#${currWinnerColor}`, fontWeight: 'bold' }}>{currWinner}</span>
      </div>
      <table className="tooltip-table">
        <thead>
          <tr>
            <th>Party</th>
            <th>Vote %</th>
            <th>Swing</th>
          </tr>
        </thead>
        <tbody>
          {partyData.map(({ name, newPct, swing, color }) => (
            <tr key={name}>
              <td>
                <span className="tooltip-color-dot" style={{ background: `#${color}` }} />
                {name}
              </td>
              <td>{newPct.toFixed(1)}%</td>
              <td className={swing > 0 ? 'swing-pos' : swing < 0 ? 'swing-neg' : 'swing-zero'}>
                {swing > 0 ? '+' : ''}{swing.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
