import { parties, provinces, partyColors, baselineProvincialPct, const_to_path_id } from '../data/constants';
import { constituencyResultsData } from '../data/constituencyData';

// Each swing entry holds the additive change (uniform) and the multiplicative ratio (proportional).
// ratio is null when the party had no baseline share, since a ratio can't be applied to 0.
function calculateSwings(pollingData) {
  const swings = {};
  provinces.forEach(province => {
    swings[province] = parties.map((_, i) => {
      const userPct = pollingData[province][i];
      const baselinePct = baselineProvincialPct[province][i] ?? 0;
      return {
        diff: userPct - baselinePct,
        ratio: baselinePct > 0 ? userPct / baselinePct : null,
      };
    });
  });
  return swings;
}

function applySwing(base, swing, mode) {
  if (!swing) return base;
  // Proportional: scale the constituency share by the provincial ratio.
  // Falls back to uniform for parties with no provincial baseline.
  if (mode === 'proportional' && swing.ratio !== null) return base * swing.ratio;
  return base + swing.diff;
}

function argMax(values) {
  let maxIdx = -1;
  let max = -Infinity;
  values.forEach((v, i) => { if (v > max) { max = v; maxIdx = i; } });
  return maxIdx;
}

// Project every constituency from provincial polling. Pure: no DOM access.
export function projectSeats(pollingData, mode) {
  const swings = calculateSwings(pollingData);
  const seats = new Array(parties.length).fill(0);
  const seatsByProvince = Object.fromEntries(provinces.map(p => [p, new Array(parties.length).fill(0)]));
  const constituencies = [];
  let errors = 0;

  constituencyResultsData.forEach((constData, i) => {
    const pathIdNum = const_to_path_id[i];
    const provinceSwings = swings[constData?.province];
    if (!constData || pathIdNum === undefined || !provinceSwings || constData.totalVotes <= 0) {
      errors++;
      return;
    }

    // Baseline vote shares per party
    const basePcts = parties.map((_, pi) => (constData.partyVotes?.[pi] || 0) / constData.totalVotes * 100);

    // Apply swing, clamp negatives to 0, normalize so sum = 100%
    const clamped = basePcts.map((base, pi) => Math.max(0, applySwing(base, provinceSwings[pi], mode)));
    const clampedTotal = clamped.reduce((s, v) => s + v, 0);
    const normalized = clampedTotal > 0
      ? clamped.map(v => v / clampedTotal * 100)
      : clamped.map(() => 0);

    const winnerIdx = argMax(normalized);
    const prevWinnerIdx = Math.max(0, argMax(basePcts));

    if (winnerIdx !== -1) {
      seats[winnerIdx] += 1;
      seatsByProvince[constData.province][winnerIdx] += 1;
    }

    // Top 5 parties by projected normalized share
    const partyData = parties
      .map((name, pi) => ({
        name,
        newPct: normalized[pi],
        swing: normalized[pi] - basePcts[pi],
        color: partyColors[pi],
      }))
      .filter(e => e.newPct > 0)
      .sort((a, b) => b.newPct - a.newPct)
      .slice(0, 5);

    constituencies.push({
      id: constData.id,
      pathId: `path${pathIdNum}`,
      province: constData.province,
      prevWinner: parties[prevWinnerIdx],
      prevWinnerColor: partyColors[prevWinnerIdx],
      currWinner: winnerIdx !== -1 ? parties[winnerIdx] : '—',
      currWinnerColor: winnerIdx !== -1 ? partyColors[winnerIdx] : '888888',
      winnerIdx,
      partyData,
      projectedPcts: normalized,
    });
  });

  return { mode, seats, seatsByProvince, constituencies, errors };
}
