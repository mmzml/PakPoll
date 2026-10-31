import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSun, faMoon, faMagnifyingGlassPlus, faMagnifyingGlassMinus, faExpand, faDownload,
  faImage, faFileCsv, faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons';
import PakistanMap from './components/PakistanMap';
import PollingTable from './components/PollingTable';
import ResultsTable from './components/ResultsTable';
import Tooltip from './components/Tooltip';
import SeatPanel from './components/SeatPanel';
import MiniMap from './components/MiniMap';
import DonutChart from './components/DonutChart';
import ConstituencyList from './components/ConstituencyList';
import {
  parties, provinces, partyColors, defaultFillColor,
  baselineProvincialPct, startingSeats,
  const_to_path_id, const_to_text_id, provinceElements,
} from './data/constants';
import { constituencyResultsData } from './data/constituencyData';
import { projectSeats } from './utils/projection';
import { downloadBlob, exportMapSvg, exportMapPng, buildResultsCsv } from './utils/exportMap';
import logoSvg from './assets/logo.svg';
import './App.css';

const initialInputs = parties.map(() => provinces.map(() => ''));
const initialProvinceSeats = Object.fromEntries(provinces.map(p => [p, new Array(parties.length).fill(0)]));

const provinceCheckboxes = [
  { id: 'kpk', label: 'KPK', key: 'KPK' },
  { id: 'pun', label: 'Punjab', key: 'Punjab' },
  { id: 'sin', label: 'Sindh', key: 'Sindh' },
  { id: 'bal', label: 'Balochistan', key: 'Balochistan' },
  { id: 'kas', label: 'Kashmir & GB', key: 'Kashmir' },
];

// Constituency id ("NA-1 Chitral") <-> SVG path id ("path1639")
const seatPathIds = new Map(constituencyResultsData.map((c, i) => [c.id, `path${const_to_path_id[i]}`]));
const pathSeatIds = new Map([...seatPathIds].map(([seat, path]) => [path, seat]));
const seatIds = [...seatPathIds.keys()];

// Accepts "125", "NA125", "na-125" or part of a name like "lahore"
function findSeat(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const num = q.match(/^(?:na\s*-?\s*)?(\d+)$/);
  if (num) return seatIds.find(id => id.match(/^NA-(\d+)/i)?.[1] === String(Number(num[1]))) ?? null;
  return seatIds.find(id => id.toLowerCase() === q)
    ?? seatIds.find(id => id.toLowerCase().includes(q))
    ?? null;
}

function describeResult(seats) {
  const total = seats.reduce((s, v) => s + v, 0);
  const majority = Math.floor(total / 2) + 1;
  const leaderIdx = seats.indexOf(Math.max(...seats));
  const count = seats[leaderIdx];
  return count >= majority
    ? `${parties[leaderIdx]} wins a majority with ${count} seats (${majority} needed)`
    : `Hung parliament: ${parties[leaderIdx]} largest with ${count} seats, ${majority - count} short of a majority`;
}

// Resolve the table into numbers per province; empty cells fall back to the 2024 baseline.
function getPollingInput(inputs) {
  const data = {};
  provinces.forEach((province, prov) => {
    data[province] = parties.map((_, pi) => {
      const value = inputs[pi][prov].trim();
      const parsed = parseFloat(value !== '' ? value : baselineProvincialPct[province][pi] ?? 0);
      return isNaN(parsed) ? 0 : parsed;
    });
  });
  return data;
}

function getProvinceTotals(pollingData) {
  return Object.fromEntries(provinces.map(province => {
    const total = pollingData[province].reduce((s, v) => s + v, 0);
    return [province, { total, valid: total >= 99 && total <= 101 }];
  }));
}

function getElementIds(provinceKey) {
  const config = provinceElements[provinceKey];
  if (!config) return [];
  const pathIds = config.pathSlice
    ? const_to_path_id.slice(...config.pathSlice).map(n => `path${n}`)
    : [];
  const textIds = config.textSlice
    ? const_to_text_id.slice(...config.textSlice).map(n => `text${n}`)
    : [];
  return [...pathIds, ...textIds, ...(config.extra || [])];
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const [inputs, setInputs] = useState(initialInputs);
  const [projection, setProjection] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [status, setStatusState] = useState({ text: "Enter polling data and click 'Generate Map'.", type: 'info' });
  const setStatus = (text, type = 'info') => setStatusState({ text, type });
  const [provincesVisible, setProvincesVisible] = useState({
    KPK: true, Punjab: true, Sindh: true, Balochistan: true, Kashmir: true,
  });
  const [currentViewBox, setCurrentViewBox] = useState(null);
  const [origViewBox, setOrigViewBox] = useState(null);
  const [swingMode, setSwingMode] = useState('uniform');
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tooltip, setTooltip] = useState({ visible: false });

  const mapRef = useRef(null);

  const pollingData = useMemo(() => getPollingInput(inputs), [inputs]);
  const provinceTotals = useMemo(() => getProvinceTotals(pollingData), [pollingData]);

  // Everything the page shows is derived from the latest projection
  const seats = projection?.seats ?? startingSeats;
  const provinceSeats = projection?.seatsByProvince ?? initialProvinceSeats;
  const constituencyList = projection?.constituencies ?? null;
  const downloadEnabled = !!projection && projection.errors === 0 && projection.missingPaths === 0;

  const seatsByPath = useMemo(
    () => new Map((constituencyList ?? []).map(c => [c.pathId, c])),
    [constituencyList],
  );
  const mapFills = useMemo(() => {
    if (!constituencyList) return null;
    return new Map(constituencyList.map(c => [
      c.pathId,
      c.winnerIdx !== -1 && partyColors[c.winnerIdx] ? `#${partyColors[c.winnerIdx]}` : defaultFillColor,
    ]));
  }, [constituencyList]);
  const hiddenIds = useMemo(
    () => new Set(provinceCheckboxes.filter(({ key }) => !provincesVisible[key]).flatMap(({ key }) => getElementIds(key))),
    [provincesVisible],
  );

  const selectedPathId = selectedSeat ? seatPathIds.get(selectedSeat) : null;
  const selectedSeatData = selectedPathId ? seatsByPath.get(selectedPathId) : null;

  useEffect(() => {
    if (!mapRef.current) return;
    const orig = mapRef.current.getOrigViewBox();
    if (orig) {
      setOrigViewBox(orig);
      setCurrentViewBox({ ...orig });
    }
    mapRef.current.subscribeViewBox(vb => setCurrentViewBox({ ...vb }));
  }, []);

  const handleSeatHover = useCallback((pathId, e) => {
    const data = pathId && seatsByPath.get(pathId);
    if (data) {
      setTooltip({ visible: true, ...data, x: e.clientX, y: e.clientY });
    } else {
      setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
    }
  }, [seatsByPath]);

  // Clicking (or tapping) a seat pins its details
  const handleSeatClick = useCallback(pathId => {
    const seat = pathSeatIds.get(pathId);
    if (seat) setSelectedSeat(seat);
  }, []);

  function handleInputChange(partyIdx, provIdx, value) {
    setInputs(prev => {
      const next = prev.map(row => [...row]);
      next[partyIdx][provIdx] = value;
      return next;
    });
  }

  function handleClear() {
    setInputs(initialInputs.map(row => [...row]));
  }

  function handleGenerateMap(mode = swingMode) {
    setStatus('Processing...');
    setTimeout(() => {
      try {
        const result = projectSeats(pollingData, mode);
        const missingPaths = result.constituencies.filter(c => !mapRef.current?.hasElement(c.pathId)).length;
        setProjection({ ...result, missingPaths });

        const offProvinces = provinces.filter(p => !provinceTotals[p].valid);
        let msg = `Map updated using ${mode} swing. Processed: ${result.constituencies.length}.`;
        if (missingPaths > 0) msg += ` Warning: ${missingPaths} map areas could not be found.`;
        if (offProvinces.length > 0) {
          msg += ` Note: ${offProvinces.map(p => `${p} totals ${provinceTotals[p].total.toFixed(1)}%`).join(', ')}, so shares were rescaled to 100%.`;
        }
        setStatus(msg, missingPaths > 0 || offProvinces.length > 0 ? 'warning' : 'success');
      } catch (err) {
        console.error(err);
        setStatus('An unexpected error occurred. Check console (F12).', 'error');
      }
    }, 50);
  }

  // Once a map exists, switching swing model redraws it straight away
  function handleSwingModeChange(mode) {
    setSwingMode(mode);
    if (projection) handleGenerateMap(mode);
  }

  function handleSearch(e) {
    e.preventDefault();
    const seat = findSeat(searchQuery);
    if (!seat) {
      setStatus(`No constituency matches "${searchQuery.trim()}".`, 'warning');
      return;
    }
    setSearchQuery(seat);
    focusSeat(seat);
  }

  // Pin a seat and zoom the map to it (used by search and the constituency list)
  function focusSeat(seat) {
    setSelectedSeat(seat);
    setActiveTab('map');
    // Wait for the map tab to be shown before measuring the seat
    requestAnimationFrame(() => mapRef.current?.zoomToElement(seatPathIds.get(seat)));
  }

  function handleDownloadSvg() {
    const svgMap = mapRef.current?.getSvg();
    if (!svgMap || !origViewBox) { setStatus('Error: Cannot find the SVG map element.', 'error'); return; }
    try {
      downloadBlob(exportMapSvg(svgMap, origViewBox), 'pakistan_polling_map_generated.svg');
      setStatus('SVG download started.');
    } catch (err) {
      console.error(err);
      setStatus('SVG download failed.', 'error');
    }
  }

  async function handleDownloadPng() {
    const svgMap = mapRef.current?.getSvg();
    if (!svgMap || !origViewBox) { setStatus('Error: Cannot find the SVG map element.', 'error'); return; }
    setStatus('Creating PNG...');
    try {
      const legend = parties
        .map((name, i) => ({ name, color: partyColors[i], count: seats[i], change: seats[i] - startingSeats[i] }))
        .filter(p => p.count > 0)
        .sort((a, b) => b.count - a.count);
      const blob = await exportMapPng(svgMap, origViewBox, {
        title: 'Pakistan National Assembly projection',
        subtitle: `${projection.mode === 'proportional' ? 'Proportional' : 'Uniform'} swing · ${describeResult(seats)} · PakPoll`,
        legend,
      });
      downloadBlob(blob, `pakpoll_projection_${projection.mode}.png`);
      setStatus('PNG download started.', 'success');
    } catch (err) {
      console.error(err);
      setStatus('PNG download failed.', 'error');
    }
  }

  function handleDownloadCsv() {
    if (!constituencyList) return;
    const csv = buildResultsCsv(constituencyList, parties);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `pakpoll_results_${projection.mode}.csv`);
    setStatus('CSV download started.', 'success');
  }

  function handleProvinceToggle(key, checked) {
    setProvincesVisible(prev => ({ ...prev, [key]: checked }));
  }

  return (
    <>
      <Tooltip tooltip={tooltip} />
      <button className="theme-toggle" onClick={() => setDarkMode(d => !d)}>
        <FontAwesomeIcon icon={darkMode ? faSun : faMoon} />
        {darkMode ? ' Light Mode' : ' Dark Mode'}
      </button>
      <img src={logoSvg} alt="PakPoll logo" className="logo" />
      <div className="container">
        <div className="left-panel">
          <div className="polling-header">
            <h2>Enter Polling Data (%)</h2>
            <button className="clear-button" onClick={handleClear}>Clear</button>
          </div>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <PollingTable inputs={inputs} onChange={handleInputChange} totals={provinceTotals} />
          </div>
          <div className="swing-toggle">
            <span className={swingMode === 'uniform' ? 'active' : ''}>Uniform swing</span>
            <label className="switch" title="Toggle between uniform and proportional swing">
              <input
                type="checkbox"
                checked={swingMode === 'proportional'}
                onChange={e => handleSwingModeChange(e.target.checked ? 'proportional' : 'uniform')}
              />
              <span className="slider" />
            </label>
            <span className={swingMode === 'proportional' ? 'active' : ''}>Proportional swing</span>
          </div>
          <div className="button-container">
            <button className="map-button" onClick={() => handleGenerateMap()}>Generate Map</button>
          </div>
          <div id="statusMessage" className={`status-${status.type}`} role="status">{status.text}</div>
        </div>

        <div className="right-panel">
          {/* Tab bar */}
          <div className="tab-bar">
            <button
              className={`tab-btn${activeTab === 'map' ? ' active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              Map
            </button>
            <button
              className={`tab-btn${activeTab === 'list' ? ' active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              Constituencies
            </button>
          </div>

          <form className="seat-search" onSubmit={handleSearch} role="search">
            <input
              type="search"
              list="seat-options"
              placeholder="Find a seat, e.g. NA-125 or Lahore"
              aria-label="Find a constituency"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <datalist id="seat-options">
              {seatIds.map(id => <option key={id} value={id} />)}
            </datalist>
            <button type="submit" className="zoom-btn" title="Find seat">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </button>
          </form>

          {/* Map tab — keep mounted so colors/zoom survive tab switches */}
          <div style={{ display: activeTab === 'map' ? 'block' : 'none' }}>
            <div className="map-wrapper">
              <PakistanMap
                ref={mapRef}
                fills={mapFills}
                fallbackFill={defaultFillColor}
                hiddenIds={hiddenIds}
                selectedId={selectedPathId}
                onSeatHover={handleSeatHover}
                onSeatClick={handleSeatClick}
              />

              {/* Zoom controls — top-right */}
              <div className="zoom-controls">
                <button className="zoom-btn" title="Zoom in"
                  onClick={() => mapRef.current?.zoomBy(0.75)}>
                  <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                </button>
                <button className="zoom-btn" title="Zoom out"
                  onClick={() => mapRef.current?.zoomBy(1.33)}>
                  <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                </button>
                <button className="zoom-btn" title="Reset zoom"
                  onClick={() => mapRef.current?.resetZoom()}>
                  <FontAwesomeIcon icon={faExpand} />
                </button>
                <button className="zoom-btn" title="Download SVG"
                  disabled={!downloadEnabled} onClick={handleDownloadSvg}>
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                <button className="zoom-btn" title="Download PNG"
                  disabled={!downloadEnabled} onClick={handleDownloadPng}>
                  <FontAwesomeIcon icon={faImage} />
                </button>
                <button className="zoom-btn" title="Download results (CSV)"
                  disabled={!downloadEnabled} onClick={handleDownloadCsv}>
                  <FontAwesomeIcon icon={faFileCsv} />
                </button>
              </div>

              {selectedSeat && (
                <SeatPanel seatId={selectedSeat} seat={selectedSeatData} onClose={() => setSelectedSeat(null)} />
              )}

              {/* Mini-map — top-left */}
              <MiniMap
                currentViewBox={currentViewBox}
                origViewBox={origViewBox}
                fills={mapFills}
                fallbackFill={defaultFillColor}
                hiddenIds={hiddenIds}
              />
            </div>
          </div>

          {/* Constituencies tab */}
          <div style={{ display: activeTab === 'list' ? 'block' : 'none' }}>
            <ConstituencyList data={constituencyList} onSelect={focusSeat} />
          </div>

          {/* Donut chart + province toggles + seat totals — always visible */}
          <DonutChart seats={seats} baselineSeats={startingSeats} parties={parties} partyColors={partyColors} />

          <h3>
            Show:{' '}
            <ul className="prov-list">
              {provinceCheckboxes.map(({ id, label, key }) => (
                <li key={id} className="new-sel">
                  <input
                    id={`${id}-sel`}
                    type="checkbox"
                    checked={provincesVisible[key]}
                    onChange={e => handleProvinceToggle(key, e.target.checked)}
                  />
                  <label htmlFor={`${id}-sel`}>{label}</label>
                </li>
              ))}
            </ul>
          </h3>
          <h2>Seat Totals</h2>
          <ResultsTable seats={seats} baselineSeats={startingSeats} provinceSeats={provinceSeats} />
        </div>
      </div>
    </>
  );
}
