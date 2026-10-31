import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import SeatDetails from './SeatDetails';

// Pinned details for a clicked or searched seat; stays until closed
export default function SeatPanel({ seatId, seat, onClose }) {
  return (
    <div className="seat-panel" role="dialog" aria-label={`Details for ${seatId}`}>
      <button className="seat-panel-close" title="Close" onClick={onClose}>
        <FontAwesomeIcon icon={faXmark} />
      </button>
      {seat ? (
        <SeatDetails seat={seat} />
      ) : (
        <>
          <div className="tooltip-title">{seatId}</div>
          <div className="seat-panel-empty">Generate the map to see projected results for this seat.</div>
        </>
      )}
    </div>
  );
}
