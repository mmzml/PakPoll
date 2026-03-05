import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
import PakistanMap from './components/PakistanMap';
import PollingTable from './components/PollingTable';
import ResultsTable from './components/ResultsTable';
import {
  parties, provinces, partyColors, defaultFillColor,
  baselineProvincialPct, startingSeats,
  const_to_path_id, const_to_text_id, provinceElements,
} from './data/constants';
import { constituencyResultsData } from './data/constituencyData';
import logoSvg from './assets/logo.svg';
import './App.css';

// Initial empty input state: [party][province] = ''
const initialInputs = parties.map(() => provinces.map(() => ''));

// Province checkbox config
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
  const [status, setStatus] = useState("Enter polling data and click 'Generate Map'.");
  const [downloadEnabled, setDownloadEnabled] = useState(false);
  const [provincesVisible, setProvincesVisible] = useState({
    KPK: true, Punjab: true, Sindh: true, Balochistan: true, Kashmir: true,
  });
  const mapRef = useRef(null);

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

      let maxPct = -Infinity;
      let winnerIdx = -1;
      for (let pi = 0; pi < parties.length; pi++) {
        const partyVote = constData.partyVotes?.[pi] || 0;
        const baselinePct = (partyVote / totalVotes) * 100;
        const finalPct = baselinePct + (provinceSwings[pi] || 0);
        if (finalPct > maxPct) { maxPct = finalPct; winnerIdx = pi; }
      }

      const pathElement = svgMap.getElementById(`path${pathIdNum}`);
      if (pathElement) {
        pathElement.style.fill = (winnerIdx !== -1 && partyColors[winnerIdx])
          ? `#${partyColors[winnerIdx]}`
          : defaultFillColor;
        if (winnerIdx !== -1) newSeats[winnerIdx] += 1;
      } else {
        pathsNotFound++;
        errors++;
      }
    }

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
      <button className="theme-toggle" onClick={() => setDarkMode(d => !d)}>
        <FontAwesomeIcon icon={darkMode ? faSun : faMoon} />
        {darkMode ? ' Light Mode' : ' Dark Mode'}
      </button>
      <img src={logoSvg} alt="PakPoll logo" className="logo" />
      <div className="container">
        <div className="left-panel">
          <h2>Enter Polling Data (%)</h2>
          <PollingTable inputs={inputs} onChange={handleInputChange} />
          <div className="button-container">
            <button className="map-button" onClick={handleGenerateMap}>Generate Map</button>
            <button className="download-button" disabled={!downloadEnabled} onClick={handleDownloadSvg}>Download SVG</button>
            <button className="clear-button" onClick={handleClear}>Clear</button>
          </div>
          <div id="statusMessage">{status}</div>
        </div>

        <div className="right-panel">
          <h2>Generated Map</h2>
          <PakistanMap ref={mapRef} />
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
          <h2 id="test">Seat Totals</h2>
          <ResultsTable seats={seats} />
        </div>
      </div>
    </>
  );
}
