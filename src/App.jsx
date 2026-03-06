import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faMagnifyingGlassPlus, faMagnifyingGlassMinus, faExpand, faDownload } from '@fortawesome/free-solid-svg-icons';
import PakistanMap from './components/PakistanMap';
import PollingTable from './components/PollingTable';
import ResultsTable from './components/ResultsTable';
import Tooltip from './components/Tooltip';
import MiniMap from './components/MiniMap';
import DonutChart from './components/DonutChart';
import ConstituencyList from './components/ConstituencyList';
import {
  parties, provinces, partyColors, defaultFillColor,
  baselineProvincialPct, startingSeats,
  const_to_path_id, const_to_text_id, provinceElements,
} from './data/constants';
import { constituencyResultsData } from './data/constituencyData';
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
  const [seats, setSeats] = useState([...startingSeats]);
  const [provinceSeats, setProvinceSeats] = useState(initialProvinceSeats);
  const [constituencyList, setConstituencyList] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [status, setStatus] = useState("Enter polling data and click 'Generate Map'.");
  const [downloadEnabled, setDownloadEnabled] = useState(false);
  const [provincesVisible, setProvincesVisible] = useState({
    KPK: true, Punjab: true, Sindh: true, Balochistan: true, Kashmir: true,
  });
  const [currentViewBox, setCurrentViewBox] = useState(null);
  const [origViewBox, setOrigViewBox] = useState(null);
  const [mapFills, setMapFills] = useState(null);

  const mapRef = useRef(null);
  const tooltipDataMapRef = useRef(null);
  const svgListenersRef = useRef({ move: null, leave: null });
  const [tooltip, setTooltip] = useState({ visible: false });

  useEffect(() => {
    if (!mapRef.current) return;
    const orig = mapRef.current.getOrigViewBox();
    if (orig) {
      setOrigViewBox(orig);
      setCurrentViewBox({ ...orig });
    }
    mapRef.current.subscribeViewBox(vb => setCurrentViewBox({ ...vb }));
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

  function getPollingInput() {
    const data = {};
    provinces.forEach(p => { data[p] = []; });

    for (let pi = 0; pi < parties.length; pi++) {
      for (let prov = 0; prov < provinces.length; prov++) {
        const value = inputs[pi][prov].trim();
        const placeholderEl = document.querySelector(
          `#pollingTable tbody tr:nth-child(${pi + 1}) td:nth-child(${prov + 2}) input`
        );
        const placeholder = placeholderEl ? placeholderEl.placeholder : '0';
        const finalStr = value !== '' ? value : placeholder;
        const finalValue = parseFloat(finalStr);
        data[provinces[prov]].push(isNaN(finalValue) ? 0 : finalValue);
      }
    }

    for (const province of provinces) {
      const total = data[province].reduce((s, v) => s + v, 0);
      if (total > 101 || total < 99) {
        console.warn(`Input Warning: Total % for ${province} is ${total.toFixed(1)}%.`);
      }
    }
    return data;
  }

  function calculateSwings(userInputData) {
    const swings = {};
    provinces.forEach(province => {
      swings[province] = [];
      for (let i = 0; i < parties.length; i++) {
        const userPct = userInputData[province][i];
        const baselinePct = baselineProvincialPct[province][i] ?? 0;
        swings[province].push(userPct - baselinePct);
      }
    });
    return swings;
  }

  function applySwingsAndColorMap(swings) {
    const svgMap = mapRef.current?.getSvg();
    if (!svgMap) {
      setStatus('Error: SVG map not found.');
      return false;
    }

    svgMap.querySelectorAll('path[id^="path"]').forEach(path => {
      path.style.fill = defaultFillColor;
    });

    const newSeats = new Array(parties.length).fill(0);
    const seatsByProvince = {};
    provinces.forEach(p => { seatsByProvince[p] = new Array(parties.length).fill(0); });

    const tooltipDataMap = new Map();
    const fillsMap = new Map();
    const constList = [];
    let errors = 0;
    let pathsNotFound = 0;

    for (let i = 0; i < constituencyResultsData.length; i++) {
      const constData = constituencyResultsData[i];
      const pathIdNum = const_to_path_id[i];
      if (!constData || pathIdNum === undefined) { errors++; continue; }

      const province = constData.province;
      const provinceSwings = swings[province];
      if (!provinceSwings) { errors++; continue; }

      const totalVotes = constData.totalVotes;
      if (totalVotes <= 0) { errors++; continue; }

      // Baseline vote shares per party
      const basePcts = parties.map((_, pi) => (constData.partyVotes?.[pi] || 0) / totalVotes * 100);

      // Apply swing, clamp negatives to 0, normalize so sum = 100%
      const clamped = basePcts.map((base, pi) => Math.max(0, base + (provinceSwings[pi] || 0)));
      const clampedTotal = clamped.reduce((s, v) => s + v, 0);
      const normalized = clampedTotal > 0
        ? clamped.map(v => v / clampedTotal * 100)
        : clamped.map(() => 0);

      // Projected winner
      let maxPct = -Infinity;
      let winnerIdx = -1;
      for (let pi = 0; pi < parties.length; pi++) {
        if (normalized[pi] > maxPct) { maxPct = normalized[pi]; winnerIdx = pi; }
      }

      // Previous winner (2024 baseline)
      let prevMax = -Infinity;
      let prevWinnerIdx = 0;
      for (let pi = 0; pi < parties.length; pi++) {
        if (basePcts[pi] > prevMax) { prevMax = basePcts[pi]; prevWinnerIdx = pi; }
      }

      const currWinner = winnerIdx !== -1 ? parties[winnerIdx] : '—';
      const currWinnerColor = winnerIdx !== -1 ? partyColors[winnerIdx] : '888888';

      // Top 5 parties by projected normalized share (computed once, used by both tooltip and list)
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

      // Always add to constituency list
      constList.push({
        id: constData.id,
        province: constData.province,
        prevWinner: parties[prevWinnerIdx],
        prevWinnerColor: partyColors[prevWinnerIdx],
        currWinner,
        currWinnerColor,
        partyData,
      });

      const pathElement = svgMap.getElementById(`path${pathIdNum}`);
      if (pathElement) {
        const fillColor = (winnerIdx !== -1 && partyColors[winnerIdx])
          ? `#${partyColors[winnerIdx]}`
          : defaultFillColor;
        pathElement.style.fill = fillColor;
        fillsMap.set(`path${pathIdNum}`, fillColor);

        if (winnerIdx !== -1) {
          newSeats[winnerIdx] += 1;
          if (seatsByProvince[province]) seatsByProvince[province][winnerIdx] += 1;
        }

        tooltipDataMap.set(`path${pathIdNum}`, {
          id: constData.id,
          province: constData.province,
          prevWinner: parties[prevWinnerIdx],
          prevWinnerColor: partyColors[prevWinnerIdx],
          currWinner,
          currWinnerColor,
          partyData,
        });
      } else {
        pathsNotFound++;
        errors++;
      }
    }

    // Attach hover event delegation to SVG (replace previous listeners)
    tooltipDataMapRef.current = tooltipDataMap;
    if (svgListenersRef.current.move) svgMap.removeEventListener('mousemove', svgListenersRef.current.move);
    if (svgListenersRef.current.leave) svgMap.removeEventListener('mouseleave', svgListenersRef.current.leave);

    function onMove(e) {
      if (e.buttons & 1) {
        setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
        return;
      }
      const target = e.target;
      if (target.tagName !== 'path') {
        setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
        return;
      }
      const data = tooltipDataMapRef.current?.get(target.id);
      if (data) {
        setTooltip({ visible: true, ...data, x: e.clientX, y: e.clientY });
      } else {
        setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
      }
    }

    function onLeave() {
      setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
    }

    svgMap.addEventListener('mousemove', onMove);
    svgMap.addEventListener('mouseleave', onLeave);
    svgListenersRef.current = { move: onMove, leave: onLeave };

    setMapFills(fillsMap);
    setProvinceSeats({ ...seatsByProvince });
    setConstituencyList(constList);

    const msg = `Map updated! Processed: ${constituencyResultsData.length - errors}.` +
      (pathsNotFound > 0 ? ` Paths not found: ${pathsNotFound}.` : '');
    setStatus(msg.trim());
    setSeats(newSeats);
    if (pathsNotFound > 0) {
      alert(`Warning: ${pathsNotFound} SVG path elements could not be found.`);
    }
    return errors === 0;
  }

  function handleGenerateMap() {
    setStatus('Processing...');
    setDownloadEnabled(false);
    setTimeout(() => {
      try {
        const userInput = getPollingInput();
        const swings = calculateSwings(userInput);
        const success = applySwingsAndColorMap(swings);
        setDownloadEnabled(success);
      } catch (err) {
        console.error(err);
        setStatus('An unexpected error occurred. Check console (F12).');
        setDownloadEnabled(false);
      }
    }, 50);
  }

  function handleDownloadSvg() {
    const svgMap = mapRef.current?.getSvg();
    if (!svgMap) { alert('Error: Cannot find the SVG map element.'); return; }
    try {
      const blob = new Blob([svgMap.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pakistan_polling_map_generated.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('SVG download started.');
    } catch (err) {
      console.error(err);
      setStatus('SVG download failed.');
    }
  }

  function handleProvinceToggle(key, checked) {
    setProvincesVisible(prev => ({ ...prev, [key]: checked }));
    const svgMap = mapRef.current?.getSvg();
    if (!svgMap) return;
    getElementIds(key).forEach(id => {
      const el = svgMap.getElementById(id);
      if (el) el.style.visibility = checked ? 'visible' : 'hidden';
    });
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
            <PollingTable inputs={inputs} onChange={handleInputChange} />
          </div>
          <div className="button-container">
            <button className="map-button" onClick={handleGenerateMap}>Generate Map</button>
          </div>
          <div id="statusMessage">{status}</div>
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

          {/* Map tab — keep mounted so colors/zoom survive tab switches */}
          <div style={{ display: activeTab === 'map' ? 'block' : 'none' }}>
            <div className="map-wrapper">
              <PakistanMap ref={mapRef} />

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
              </div>

              {/* Mini-map — bottom-right */}
              <MiniMap
                currentViewBox={currentViewBox}
                origViewBox={origViewBox}
                fills={mapFills}
              />
            </div>
          </div>

          {/* Constituencies tab */}
          <div style={{ display: activeTab === 'list' ? 'block' : 'none' }}>
            <ConstituencyList data={constituencyList} />
          </div>

          {/* Donut chart + province toggles + seat totals — always visible */}
          <DonutChart seats={seats} parties={parties} partyColors={partyColors} />

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
          <ResultsTable seats={seats} provinceSeats={provinceSeats} />
        </div>
      </div>
    </>
  );
}
