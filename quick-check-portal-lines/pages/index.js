
import { useMemo, useState } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';

// DEMO distances (nm) — replace with NOAA tables for production
const DISTANCES = {
  'Inside Passage (SE Alaska)': {
    ports: ['Juneau, AK','Haines, AK','Skagway, AK','Sitka, AK','Petersburg, AK','Wrangell, AK','Ketchikan, AK','Hoonah, AK'],
    nm: {
      'Juneau, AK': {'Haines, AK': 73, 'Skagway, AK': 94, 'Sitka, AK': 95, 'Petersburg, AK': 120, 'Wrangell, AK': 155, 'Ketchikan, AK': 235, 'Hoonah, AK': 33},
      'Haines, AK': {'Skagway, AK': 14, 'Petersburg, AK': 140},
      'Skagway, AK': {},
      'Sitka, AK': {'Petersburg, AK': 109, 'Wrangell, AK': 144, 'Ketchikan, AK': 192},
      'Petersburg, AK': {'Wrangell, AK': 31, 'Ketchikan, AK': 116},
      'Wrangell, AK': {'Ketchikan, AK': 82},
      'Ketchikan, AK': {},
      'Hoonah, AK': {},
    }
  },
  'Puget Sound / Salish Sea': {
    ports: ['Seattle, WA','Bremerton, WA','Tacoma, WA','Everett, WA','Port Townsend, WA','Bellingham, WA'],
    nm: {
      'Seattle, WA': {'Bremerton, WA': 14, 'Tacoma, WA': 25, 'Everett, WA': 28, 'Port Townsend, WA': 35, 'Bellingham, WA': 70},
      'Bremerton, WA': {'Tacoma, WA': 29, 'Everett, WA': 34, 'Port Townsend, WA': 24, 'Bellingham, WA': 77},
      'Tacoma, WA': {'Everett, WA': 43, 'Port Townsend, WA': 49, 'Bellingham, WA': 89},
      'Everett, WA': {'Port Townsend, WA': 28, 'Bellingham, WA': 46},
      'Port Townsend, WA': {'Bellingham, WA': 40},
      'Bellingham, WA': {},
    }
  },
};

// Define service LINES (ordered stops). No all-pairs explosion.
const LINES = {
  'Inside Passage (SE Alaska)': [
    { id: 'JNU-HNS-SGY', name: 'Juneau — Haines — Skagway', stops: ['Juneau, AK','Haines, AK','Skagway, AK'] },
    { id: 'JNU-SIT', name: 'Juneau — Sitka', stops: ['Juneau, AK','Sitka, AK'] },
    { id: 'JNU-PSG-WRG-KTN', name: 'Juneau — Petersburg — Wrangell — Ketchikan', stops: ['Juneau, AK','Petersburg, AK','Wrangell, AK','Ketchikan, AK'] },
    { id: 'JNU-HNH', name: 'Juneau — Hoonah', stops: ['Juneau, AK','Hoonah, AK'] },
  ],
  'Puget Sound / Salish Sea': [
    { id: 'SEA-BRE', name: 'Seattle — Bremerton', stops: ['Seattle, WA','Bremerton, WA'] },
    { id: 'SEA-EVE-PT', name: 'Seattle — Everett — Port Townsend', stops: ['Seattle, WA','Everett, WA','Port Townsend, WA'] },
    { id: 'SEA-TAC', name: 'Seattle — Tacoma', stops: ['Seattle, WA','Tacoma, WA'] },
  ],
};

// DEMO annual demand per OD pair (A↔B). Replace with TranStats.
const DEMAND = {
  'Juneau, AK ⇄ Haines, AK': 82400,
  'Juneau, AK ⇄ Skagway, AK': 42000,
  'Haines, AK ⇄ Skagway, AK': 18000,
  'Juneau, AK ⇄ Sitka, AK': 70500,
  'Juneau, AK ⇄ Petersburg, AK': 61200,
  'Petersburg, AK ⇄ Wrangell, AK': 31000,
  'Wrangell, AK ⇄ Ketchikan, AK': 42000,
  'Juneau, AK ⇄ Wrangell, AK': 41800,
  'Juneau, AK ⇄ Ketchikan, AK': 35000,
  'Juneau, AK ⇄ Hoonah, AK': 30000,
  'Seattle, WA ⇄ Bremerton, WA': 120000,
  'Seattle, WA ⇄ Tacoma, WA': 95000,
  'Seattle, WA ⇄ Everett, WA': 88000,
  'Everett, WA ⇄ Port Townsend, WA': 50000,
};

function routeKey(a,b){ return a < b ? `${a} ⇄ ${b}` : `${b} ⇄ ${a}`; }

function segmentNm(nmMatrix, a, b){
  return (nmMatrix[a] && nmMatrix[a][b]) || (nmMatrix[b] && nmMatrix[b][a]) || null;
}

// Given an ordered list of stops, return the list of adjacent segments [{a,b,nm}...]
function lineSegments(stops, nmMatrix){
  const segs = [];
  for(let i=0;i<stops.length-1;i++){
    const a = stops[i], b = stops[i+1];
    const nm = segmentNm(nmMatrix, a, b);
    if(nm == null) return null;
    if(nm > 500) return null; // first-contact filter
    segs.push({a,b,nm});
  }
  return segs;
}

// Get path segments between two stops along a line (assumes stops are on the line)
function pathBetween(stops, segs, origin, dest){
  const i = stops.indexOf(origin);
  const j = stops.indexOf(dest);
  if(i === -1 || j === -1) return null;
  const low = Math.min(i,j);
  const high = Math.max(i,j);
  return segs.slice(low, high); // contiguous segments along the line
}

export default function Home(){
  const [area, setArea] = useState('Inside Passage (SE Alaska)');
  const [speed, setSpeed] = useState(75); // knots (Marlin wingship)
  const [opsHours, setOpsHours] = useState(12);
  const [dwellMin, setDwellMin] = useState(12); // per stop call
  const [fare, setFare] = useState(120);
  const [loadFactor, setLoadFactor] = useState(0.75);
  const [costPerNm, setCostPerNm] = useState(8);
  const [reservePct, setReservePct] = useState(0.15);
  const [captureRate, setCaptureRate] = useState(0.25); // Medium preset
  const [budgetFleet, setBudgetFleet] = useState(0);
  const [result, setResult] = useState(null);

  const nmMatrix = DISTANCES[area].nm;
  const lines = LINES[area];

  const computed = useMemo(()=>{
    // Compute metrics per line
    const effSeats = Math.max(1, Math.floor(20 * loadFactor));
    const lineResults = [];

    for(const line of lines){
      const segs = lineSegments(line.stops, nmMatrix);
      if(!segs) continue; // skip lines with missing distances or >500 nm segments

      // Cycle time for a full end-to-end round trip (A..Z..A)
      const oneWayHours = segs.reduce((s,sg)=> s + sg.nm / speed, 0);
      const callsPerRoundTrip = 2 * line.stops.length; // simple approximation: call each stop both directions
      const cycleHours = 2*oneWayHours + (callsPerRoundTrip * dwellMin / 60);

      const tripsPerVesselPerDay = Math.max(0, Math.floor(opsHours / cycleHours));
      const paxPerTrip = effSeats;
      const paxPerVesselDay = tripsPerVesselPerDay * paxPerTrip;

      // Demand on the line (only for OD pairs that lie on this line—no all-pairs)
      // We'll include hub-related and adjacent pairs commonly served on the line.
      const candidatePairs = [];
      // include all neighbor pairs on the line
      for(let i=0;i<line.stops.length-1;i++){
        candidatePairs.push(routeKey(line.stops[i], line.stops[i+1]));
      }
      // include hub-to-each if Juneau/Seattle present
      const hub = line.stops.find(s => /Juneau|Seattle|San Francisco|Chicago/.test(s));
      if(hub){
        for(const s of line.stops){
          if(s !== hub) candidatePairs.push(routeKey(hub, s));
        }
      }

      // Build segment load profile
      const segLoads = segs.map(sg => ({...sg, paxPerDay: 0}));
      let capturedTotalPerDay = 0;
      for(const key of candidatePairs){
        const annual = DEMAND[key] ?? 0;
        if(!annual) continue;
        const captured = (annual * captureRate) / 365;
        // Find origin/dest from key
        const [a,b] = key.split(' ⇄ ');
        const path = pathBetween(line.stops, segs, a, b);
        if(!path) continue;
        // Add this flow to each segment of the path
        for(const p of path){
          const idx = segLoads.findIndex(sg => (sg.a===p.a && sg.b===p.b) || (sg.a===p.b && sg.b===p.a));
          if(idx>=0) segLoads[idx].paxPerDay += captured;
        }
        capturedTotalPerDay += captured;
      }

      const peakSegLoad = segLoads.reduce((m,sg)=> Math.max(m, sg.paxPerDay), 0);
      const tripsNeededPerDay = Math.ceil(peakSegLoad / Math.max(paxPerTrip,1));
      const vesselsNeeded = tripsPerVesselPerDay>0 ? Math.ceil(tripsNeededPerDay / tripsPerVesselPerDay) : Infinity;

      // Economics (demo): use entire line's out-and-back nm for per-trip variable cost
      const lineNmRoundTrip = 2 * segs.reduce((s,sg)=> s + sg.nm, 0);
      const revenuePerTrip = fare * paxPerTrip;
      const variableCostPerTrip = costPerNm * lineNmRoundTrip;
      const marginPerTrip = revenuePerTrip - variableCostPerTrip;
      const marginPerVesselDay = marginPerTrip * tripsPerVesselPerDay;
      const marginPerHour = marginPerVesselDay / Math.max(opsHours,1);

      lineResults.push({
        id: line.id, name: line.name, stops: line.stops, segs, segLoads,
        cycleHours, tripsPerVesselPerDay, paxPerVesselDay,
        paxPerTrip, peakSegLoad, tripsNeededPerDay, vesselsNeeded,
        marginPerVesselDay, marginPerHour, capturedTotalPerDay
      });
    }

    // Fleet recommendation (Phase 1)
    const fleetRecommendedRaw = lineResults.reduce((s,r)=> s + (r.vesselsNeeded === Infinity ? 0 : r.vesselsNeeded), 0);
    const fleetRecommended = Math.ceil(fleetRecommendedRaw * (1 + reservePct));
    const capturedPaxDay = lineResults.reduce((s,r)=> s + r.capturedTotalPerDay, 0);

    // Optional budget allocation (Phase 2)
    let budget = null;
    if(budgetFleet && budgetFleet>0){
      const ranked = [...lineResults].sort((a,b)=> b.marginPerHour - a.marginPerHour);
      let remaining = budgetFleet;
      const allocation = [];
      for(const r of ranked){
        if(remaining<=0) break;
        const v = Math.min(remaining, Math.max(0, r.vesselsNeeded));
        if(v>0){
          allocation.push({ line: r.name, vessels: v, tripsPerVesselPerDay: r.tripsPerVesselPerDay, paxPerVesselDay: r.paxPerVesselDay, cycleHours: r.cycleHours, marginPerVesselDay: r.marginPerVesselDay });
          remaining -= v;
        }
      }
      const paxDay = allocation.reduce((s,a)=> s + a.vessels*a.paxPerVesselDay, 0);
      const marginDay = allocation.reduce((s,a)=> s + a.vessels*a.marginPerVesselDay, 0);
      budget = { fleetBudget: budgetFleet, allocation, paxDay, marginDay, fleetUsed: (budgetFleet-remaining) };
    }

    return {
      lines: lineResults,
      fleetRecommended, fleetRecommendedRaw, capturedPaxDay,
      effSeats: Math.floor(20*loadFactor),
      budget
    };
  }, [area, speed, opsHours, dwellMin, fare, loadFactor, costPerNm, reservePct, captureRate, budgetFleet]);

  function run(){ setResult(computed); }

  return (
    <div className="container">
      <Head><title>Pacific Seaflight Quick Check — Lines</title></Head>
      <div className="card">
        <h1 className="h1">Quick Check — Line-based (no all-pairs)</h1>
        <p className="subtitle">Select a service area. We evaluate predefined service <b>lines</b> (multi-stop corridors), compute line cycle times, peak segment loads, and recommend the fleet needed to serve the captured market. Segments &gt; 500 nm are excluded.</p>
        <div className="row">
          <div>
            <label className="label">Service Area</label>
            <select className="select" value={area} onChange={e=>{ setArea(e.target.value); setResult(null); }}>
              {Object.keys(DISTANCES).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Capture rate of market</label>
            <input className="input" type="number" step="0.05" min="0.05" max="0.8" value={captureRate} onChange={e=>setCaptureRate(Number(e.target.value))} />
          </div>
        </div>

        <div className="row">
          <div>
            <label className="label">Cruise speed (knots)</label>
            <input className="input" type="number" min="20" max="90" value={speed} onChange={e=>setSpeed(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Ops hours per day</label>
            <input className="input" type="number" min="6" max="24" value={opsHours} onChange={e=>setOpsHours(Number(e.target.value))} />
          </div>
        </div>

        <div className="row">
          <div>
            <label className="label">Port dwell per call (min)</label>
            <input className="input" type="number" min="5" max="45" value={dwellMin} onChange={e=>setDwellMin(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Target load factor</label>
            <input className="input" type="number" step="0.05" min="0.1" max="1" value={loadFactor} onChange={e=>setLoadFactor(Number(e.target.value))} />
          </div>
        </div>

        <div className="row">
          <div>
            <label className="label">Avg fare per passenger (USD)</label>
            <input className="input" type="number" min="10" value={fare} onChange={e=>setFare(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Variable cost per nm (USD)</label>
            <input className="input" type="number" min="1" value={costPerNm} onChange={e=>setCostPerNm(Number(e.target.value))} />
          </div>
        </div>

        <div className="row">
          <div>
            <label className="label">Maintenance reserve (fraction)</label>
            <input className="input" type="number" step="0.05" min="0" max="0.5" value={reservePct} onChange={e=>setReservePct(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Optional budget: I can start with up to N vessels</label>
            <input className="input" type="number" min="0" value={budgetFleet} onChange={e=>setBudgetFleet(Number(e.target.value))} />
          </div>
        </div>

        <div className="row">
          <div></div>
          <div>
            <label className="label">&nbsp;</label>
            <button className="btn" onClick={run}>Run Quick Check</button>
          </div>
        </div>
      </div>

      {result && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card">
          <h3>Phase 1 — Fleet needed to serve captured market (line-based)</h3>
          <div className="grid3">
            <div className="stat"><div className="k">{result.lines.length}</div><div className="small">Lines evaluated</div></div>
            <div className="stat"><div className="k">{Math.ceil(result.fleetRecommended)}</div><div className="small">Recommended fleet (incl. reserve)</div></div>
            <div className="stat"><div className="k">{Math.round(result.capturedPaxDay).toLocaleString()}</div><div className="small">Captured pax/day</div></div>
          </div>

          <table className="table">
            <thead>
              <tr><th>Line</th><th>Stops</th><th>Cycle (h)</th><th>Trips/vessel/day</th><th>Pax/trip</th><th>Peak seg load (pax/day)</th><th>Trips/day needed</th><th>Vessels needed</th></tr>
            </thead>
            <tbody>
              {result.lines.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.stops.join(' → ')}</td>
                  <td>{r.cycleHours.toFixed(2)}</td>
                  <td>{r.tripsPerVesselPerDay}</td>
                  <td>{r.paxPerTrip}</td>
                  <td>{Math.ceil(r.peakSegLoad)}</td>
                  <td>{r.tripsNeededPerDay}</td>
                  <td>{r.vesselsNeeded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {result && result.budget && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card">
          <h3>Phase 2 — Starter network within budget ({result.budget.fleetBudget} vessels)</h3>
          {result.budget.allocation.length === 0 ? (
            <p>No positive-margin lines can be recommended with the current settings.</p>
          ) : (
            <>
              <table className="table">
                <thead><tr><th>Line</th><th>Vessels</th><th>Cycle (h)</th><th>Trips/vessel/day</th><th>Pax/vessel/day</th><th>Daily margin (per vessel)</th></tr></thead>
                <tbody>
                  {result.budget.allocation.map(a => (
                    <tr key={a.line}>
                      <td>{a.line}</td>
                      <td>{a.vessels}</td>
                      <td>{a.cycleHours.toFixed(2)}</td>
                      <td>{a.tripsPerVesselPerDay}</td>
                      <td>{a.paxPerVesselDay}</td>
                      <td>${Math.round(a.marginPerVesselDay).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{display:'flex', gap:24, flexWrap:'wrap', marginTop:10}}>
                <div><strong>Fleet used:</strong> {result.budget.fleetUsed}/{result.budget.fleetBudget}</div>
                <div><strong>Network capacity/day:</strong> {Math.round(result.budget.paxDay).toLocaleString()} pax</div>
                <div><strong>Total daily margin (demo):</strong> ${Math.round(result.budget.marginDay).toLocaleString()}</div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
