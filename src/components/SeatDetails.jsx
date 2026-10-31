import { partyTextStyle } from '../utils/partyText';

// Seat breakdown shared by the hover tooltip and the pinned seat panel.
// Before a map is generated the seat is the 2024 result (isBaseline), shown without
// projection or swing columns.
export default function SeatDetails({ seat }) {
  const { id, province, prevWinner, prevWinnerColor, currWinner, currWinnerColor, partyData, isBaseline } = seat;
  const margin = partyData.length > 1 ? partyData[0].newPct - partyData[1].newPct : null;
  const marginText = margin !== null && <span className="tooltip-margin"> by {margin.toFixed(1)} pts</span>;

  return (
    <>
      <div className="tooltip-title">{id} — {province}</div>
      {isBaseline ? (
        <div className="tooltip-curr-winner">
          2024 winner:{' '}
          <span style={partyTextStyle(prevWinnerColor)}>{prevWinner}</span>
          {marginText}
        </div>
      ) : (
        <>
          <div className="tooltip-prev-winner">
            Prev. winner:{' '}
            <span style={partyTextStyle(prevWinnerColor)}>{prevWinner}</span>
          </div>
          <div className="tooltip-curr-winner">
            Proj. winner:{' '}
            <span style={partyTextStyle(currWinnerColor)}>{currWinner}</span>
            {marginText}
          </div>
        </>
      )}
      <table className="tooltip-table">
        <thead>
          <tr>
            <th>Party</th>
            <th>{isBaseline ? '2024 vote %' : 'Vote %'}</th>
            {!isBaseline && <th>Swing</th>}
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
              {!isBaseline && (
                <td className={swing > 0 ? 'swing-pos' : swing < 0 ? 'swing-neg' : 'swing-zero'}>
                  {swing > 0 ? '+' : ''}{swing.toFixed(1)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
