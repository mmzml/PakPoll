import { partyTextStyle } from '../utils/partyText';

// Seat breakdown shared by the hover tooltip and the pinned seat panel
export default function SeatDetails({ seat }) {
  const { id, province, prevWinner, prevWinnerColor, currWinner, currWinnerColor, partyData } = seat;
  const margin = partyData.length > 1 ? partyData[0].newPct - partyData[1].newPct : null;

  return (
    <>
      <div className="tooltip-title">{id} — {province}</div>
      <div className="tooltip-prev-winner">
        Prev. winner:{' '}
        <span style={partyTextStyle(prevWinnerColor)}>{prevWinner}</span>
      </div>
      <div className="tooltip-curr-winner">
        Proj. winner:{' '}
        <span style={partyTextStyle(currWinnerColor)}>{currWinner}</span>
        {margin !== null && <span className="tooltip-margin"> by {margin.toFixed(1)} pts</span>}
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
    </>
  );
}
