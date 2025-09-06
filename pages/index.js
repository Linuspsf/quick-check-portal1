
import { useMemo, useState } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import '../styles/globals.css';

/** DEMO distances (nm) and demand — replace with NOAA + TranStats in production */
const DISTANCES = {
  'San Francisco Bay': {
    ports: ['San Francisco, CA','Oakland, CA','Richmond, CA','Vallejo, CA','Redwood City, CA','Sausalito, CA'],
    nm: {
      'San Francisco, CA': {'Oakland, CA': 7, 'Richmond, CA': 12, 'Vallejo, CA': 31, 'Redwood City, CA': 24, 'Sausalito, CA': 5},
      'Oakland, CA': {'Richmond, CA': 10, 'Vallejo, CA': 28, 'Redwood City, CA': 22, 'Sausalito, CA': 12},
      'Richmond, CA': {'Vallejo, CA': 19, 'Redwood City, CA': 30, 'Sausalito, CA': 13},
      'Vallejo, CA': {'Redwood City, CA': 44, 'Sausalito, CA': 27},
      'Redwood City, CA': {'Sausalito, CA': 28},
    },
  },
  'Puget Sound / Salish Sea': {
    ports: ['Seattle, WA','Bremerton, WA','Tacoma, WA','Everett, WA','Port Townsend, WA','Bellingham, WA', 'Victoria, BC'],
    nm: {
      'Seattle, WA': {'Bremerton, WA': 14, 'Tacoma, WA': 25, 'Everett, WA': 28, 'Port Townsend, WA': 35, 'Bellingham, WA': 70, 'Victoria, BC': 74},
      'Bremerton, WA': {'Tacoma, WA': 29, 'Everett, WA': 34, 'Port Townsend, WA': 24, 'Bellingham, WA': 77, 'Victoria, BC': 65},
      'Tacoma, WA': {'Everett, WA': 43, 'Port Townsend, WA': 49, 'Bellingham, WA': 89, 'Victoria, BC': 84},
      'Everett, WA': {'Port Townsend, WA': 28, 'Bellingham, WA': 46, 'Victoria, BC': 60},
      'Port Townsend, WA': {'Bellingham, WA': 40, 'Victoria, BC': 23},
      'Bellingham, WA': {'Victoria, BC': 52},
    },
  },
  'Inside Passage (SE Alaska)': {
    ports: ['Juneau, AK','Haines, AK','Skagway, AK','Sitka, AK','Petersburg, AK','Wrangell, AK','Ketchikan, AK'],
    nm: {
      'Juneau, AK': {'Haines, AK': 73, 'Skagway, AK': 94, 'Sitka, AK': 95, 'Petersburg, AK': 120, 'Wrangell, AK': 155, 'Ketchikan, AK': 235},
      'Haines, AK': {'Skagway, AK': 14, 'Sitka, AK': 167, 'Petersburg, AK': 140},
      'Skagway, AK': {'Sitka, AK': 188, 'Petersburg, AK': 161},
      'Sitka, AK': {'Petersburg, AK': 109, 'Wrangell, AK': 144, 'Ketchikan, AK': 192},
      'Petersburg, AK': {'Wrangell, AK': 31, 'Ketchikan, AK': 116},
      'Wrangell, AK': {'Ketchikan, AK': 82},
    },
  },
  'Lake Michigan': {
    ports: ['Chicago, IL','Milwaukee, WI','Muskegon, MI','Ludington, MI','Green Bay, WI','Traverse City, MI'],
    nm: {
      'Chicago, IL': {'Milwaukee, WI': 77, 'Muskegon, MI': 98, 'Ludington, MI': 134, 'Green Bay, WI': 192, 'Traverse City, MI': 250},
      'Milwaukee, WI': {'Muskegon, MI': 80, 'Ludington, MI': 116, 'Green Bay, WI': 117, 'Traverse City, MI': 189},
      'Muskegon, MI': {'Ludington, MI': 44, 'Green Bay, WI': 159, 'Traverse City, MI': 106},
      'Ludington, MI': {'Green Bay, WI': 125, 'Traverse City, MI': 86},
      'Green Bay, WI': {'Traverse City, MI': 173},
    },
  },
};

const DEMAND = {
  'Juneau, AK ⇄ Haines, AK': 82400,
  'Juneau, AK ⇄ Skagway, AK': 42000,
  'Juneau, AK ⇄ Sitka, AK': 70500,
  'Juneau, AK ⇄ Petersburg, AK': 61200,
  'Juneau, AK ⇄ Wrangell, AK': 41800,
  'Juneau, AK ⇄ Ketchikan, AK': 35000,
  'Seattle, WA ⇄ Bremerton, WA': 120000,
  'Seattle, WA ⇄ Tacoma, WA': 95000,
  'Seattle, WA ⇄ Everett, WA': 88000,
  'Seattle, WA ⇄ Port Townsend, WA': 60000,
  'Seattle, WA ⇄ Bellingham, WA': 45000,
  'San Francisco, CA ⇄ Oakland, CA': 130000,
  'San Francisco, CA ⇄ Vallejo, CA': 90000,
  'San Francisco, CA ⇄ Sausalito, CA': 110000,
  'San Francisco, CA ⇄ Redwood City, CA': 70000,
  'Chicago, IL ⇄ Milwaukee, WI': 125000,
  'Chicago, IL ⇄ Muskegon, MI': 80000,
  'Chicago, IL ⇄ Ludington, MI': 65000,
};

const PRESETS = {
  small: { label: 'Small', captureRate: 0.15 },
  medium: { label: 'Medium', captureRate: 0.25 },
  large: { label: 'Large', captureRate: 0.35 },
};

function routeKey(a,b){ return a < b ? `${a} ⇄ ${b}` : `${b} ⇄ ${a}`; }

function pairList(areaPorts, home){
  const pairs = [];
  if(home){
    areaPorts.forEach(p => { if(p!==home) pairs.push([home,p]); });
  } else {
    for(let i=0;i<areaPorts.length;i++){
      for(let j=i+1;j<areaPorts.length;j++){
        pairs.push([areaPorts[i], areaPorts[j]]);
      }
    }
  }
  return pairs;
}

export default function Home(){
  const [mode, setMode] = useState('area'); // 'area' or 'home'
  const [area, setArea] = useState('Inside Passage (SE Alaska)');
  const [home, setHome] = useState('Juneau, AK');
  const [preset, setPreset] = useState('medium');
  const [speed, setSpeed] = useState(40); // knots
  const [opsHours, setOpsHours] = useState(12);
  const [portTimeMin, setPortTimeMin] = useState(15);
  const [fare, setFare] = useState(120);
  const [loadFactor, setLoadFactor] = useState(0.75);
  const [costPerNm, setCostPerNm] = useState(8);
  const [reservePct, setReservePct] = useState(0.15); // maintenance reserve
  const [budgetFleet, setBudgetFleet] = useState(0); // optional affordability override
  const [result, setResult] = useState(null);

  const ports = DISTANCES[area].ports;
  const nmMatrix = DISTANCES[area].nm;

  const candidates = useMemo(() => {
    const basePairs = pairList(ports, mode==='home'?home:null);
    const rows = basePairs.map(([a,b]) => {
      const rk = routeKey(a,b);
      const d = (nmMatrix[a] && nmMatrix[a][b]) || (nmMatrix[b] && nmMatrix[b][a]) || null;
      return { a, b, rk, nm: d };
    }).filter(r => r.nm !== null && r.nm <= 500);
    return rows;
  }, [ports, nmMatrix, mode, home]);

  function compute(){
    const p = PRESETS[preset];
    const effSeats = Math.max(1, Math.floor(20 * loadFactor)); // 20-seat wingship

    // Phase 1 — recommend fleet to serve identified market (captured demand)
    const perRoute = candidates.map(r => {
      const distNm = r.nm;
      const transitHours = distNm / speed; // one-way
      const cycleHours = 2*transitHours + (2*portTimeMin/60); // round-trip incl. both ports
      const tripsPerVesselPerDay = Math.max(0, Math.floor(opsHours / cycleHours));
      const paxPerTrip = effSeats;
      const demand = DEMAND[r.rk] ?? Math.max(20000, Math.round(1000*distNm/2)); // fallback
      const captured = Math.round(demand * p.captureRate);
      const capturedPerDay = captured / 365;
      const tripsNeededPerDay = Math.ceil(capturedPerDay / Math.max(paxPerTrip,1));
      const vesselsNeeded = tripsPerVesselPerDay>0 ? Math.ceil(tripsNeededPerDay / tripsPerVesselPerDay) : Infinity;

      // economics
      const revenuePerTrip = fare * paxPerTrip;
      const variableCostPerTrip = costPerNm * (2*distNm);
      const marginPerTrip = revenuePerTrip - variableCostPerTrip;
      const marginPerVesselDay = marginPerTrip * tripsPerVesselPerDay;
      const marginPerHour = marginPerVesselDay / Math.max(opsHours,1);

      return { ...r, distNm, cycleHours, tripsPerVesselPerDay, paxPerTrip, demand, captured, capturedPerDay, tripsNeededPerDay, vesselsNeeded, marginPerHour, marginPerVesselDay };
    }).filter(r => r.vesselsNeeded !== Infinity);

    const fleetRecommendedRaw = perRoute.reduce((s,r)=> s + r.vesselsNeeded, 0);
    const fleetRecommended = Math.ceil(fleetRecommendedRaw * (1 + reservePct));

    // Phase 2 — if client enters a budget fleet, recommend best subset within budget
    let allocation = [];
    let fleetUsed = 0;
    if(budgetFleet && budgetFleet > 0){
      const ranked = [...perRoute].sort((a,b)=> b.marginPerHour - a.marginPerHour);
      let remaining = budgetFleet;
      for(const r of ranked){
        if(remaining<=0) break;
        const v = Math.min(remaining, r.vesselsNeeded);
        if(v>0){
          allocation.push({ route: r.rk, vessels: v, tripsPerVesselPerDay: r.tripsPerVesselPerDay, paxPerTrip: r.paxPerTrip, cycleHours: r.cycleHours, distNm: r.distNm, marginPerVesselDay: r.marginPerVesselDay, capturedPerDay: r.capturedPerDay });
          remaining -= v;
          fleetUsed += v;
        }
      }
    }

    const totals = {
      routesCount: perRoute.length,
      paxDayFull: perRoute.reduce((s,r)=> s + r.capturedPerDay, 0),
      tripsDayFull: perRoute.reduce((s,r)=> s + r.tripsNeededPerDay, 0),
    };

    const budgetTotals = allocation.length ? {
      paxDay: allocation.reduce((s,a)=> s + a.vessels * a.tripsPerVesselPerDay * a.paxPerTrip, 0),
      marginDay: allocation.reduce((s,a)=> s + a.vessels * a.marginPerVesselDay, 0),
    } : null;

    setResult({
      preset: p.label,
      effSeats,
      perRoute,
      fleetRecommended,
      fleetRecommendedRaw,
      reservePct,
      totals,
      budget: budgetFleet>0 ? { fleetBudget: budgetFleet, allocation, fleetUsed, totals: budgetTotals } : null
    });
  }

  return (
    <div className="container">
      <Head><title>Pacific Seaflight Quick Check</title></Head>
      <div className="card">
        <h1 className="h1">Quick Check — Service Area / Home Port</h1>
        <p className="subtitle">Phase 1: we estimate the **fleet size needed** to serve the identified market within 500 nm. Phase 2 (optional): enter what you can afford and we’ll suggest a starter network.</p>

        <div className="row">
          <div>
            <label className="label">Mode</label>
            <select className="select" value={mode} onChange={e=>setMode(e.target.value)}>
              <option value="area">Service Area</option>
              <option value="home">Home Port</option>
            </select>
          </div>
          <div>
            <label className="label">Market Preset</label>
            <select className="select" value={preset} onChange={e=>setPreset(e.target.value)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>

        <div className="row">
          <div>
            <label className="label">Service Area</label>
            <select className="select" value={area} onChange={e=>{ setArea(e.target.value); setHome(DISTANCES[e.target.value].ports[0]);}}>
              {Object.keys(DISTANCES).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Home Port (optional)</label>
            <select className="select" value={home} onChange={e=>setHome(e.target.value)} disabled={mode!=='home'}>
              {DISTANCES[area].ports.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="row">
          <div>
            <label className="label">Cruise speed (knots)</label>
            <input className="input" type="number" min="10" max="80" value={speed} onChange={e=>setSpeed(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Ops hours per day</label>
            <input className="input" type="number" min="6" max="24" value={opsHours} onChange={e=>setOpsHours(Number(e.target.value))} />
          </div>
        </div>

        <div className="row">
          <div>
            <label className="label">Port time per call (minutes)</label>
            <input className="input" type="number" min="5" max="60" value={portTimeMin} onChange={e=>setPortTimeMin(Number(e.target.value))} />
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
            <label className="label">Maintenance reserve</label>
            <input className="input" type="number" step="0.05" min="0" max="0.5" value={reservePct} onChange={e=>setReservePct(Number(e.target.value))} />
            <span className="small">Fraction of fleet (e.g., 0.15 = 15%).</span>
          </div>
          <div>
            <label className="label">Optional budget: I can start with up to N vessels</label>
            <input className="input" type="number" min="0" value={budgetFleet} onChange={e=>setBudgetFleet(Number(e.target.value))} />
            <span className="small">Leave 0 to skip Phase 2.</span>
          </div>
        </div>

        <div className="row">
          <div></div>
          <div>
            <label className="label">&nbsp;</label>
            <button className="btn" onClick={compute}>Run Quick Check</button>
          </div>
        </div>

        <hr/>
        <p className="small">Routes longer than 500 nautical miles are excluded. Distances are nautical miles along safe navigable routes; time = nm ÷ knots. Demo values only.</p>
      </div>

      {result && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card">
          <h3>Phase 1 — Fleet needed to serve identified market</h3>
          <div className="grid3">
            <div className="stat"><div className="k">{result.perRoute.length}</div><div className="small">Routes ≤ 500 nm evaluated</div></div>
            <div className="stat"><div className="k">{Math.ceil(result.fleetRecommended)}</div><div className="small">Recommended fleet (incl. reserve)</div></div>
            <div className="stat"><div className="k">{Math.round(result.totals.paxDayFull).toLocaleString()}</div><div className="small">Captured passengers per day</div></div>
          </div>
          <table className="table">
            <thead>
              <tr><th>Route</th><th>NM</th><th>Cycle (h)</th><th>Trips/vessel/day</th><th>Pax/trip</th><th>Trips/day needed</th><th>Vessels needed</th></tr>
            </thead>
            <tbody>
              {result.perRoute.map(r => (
                <tr key={r.rk}>
                  <td>{r.rk}</td><td>{r.distNm}</td><td>{r.cycleHours.toFixed(2)}</td><td>{r.tripsPerVesselPerDay}</td><td>{r.paxPerTrip}</td><td>{r.tripsNeededPerDay}</td><td>{r.vesselsNeeded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {result && result.budget && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card">
          <h3>Phase 2 — Starter network within your budget ({result.budget.fleetBudget} vessels)</h3>
          {result.budget.allocation.length === 0 ? (
            <p>No positive-margin routes can be recommended with the current settings.</p>
          ) : (
            <>
              <table className="table">
                <thead><tr><th>Route</th><th>Vessels</th><th>Cycle (h)</th><th>Trips/vessel/day</th><th>Pax/vessel/day</th><th>Daily margin (per vessel)</th></tr></thead>
                <tbody>
                  {result.budget.allocation.map(a => (
                    <tr key={a.route}>
                      <td>{a.route}</td>
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
                {result.budget.totals && <div><strong>Network capacity/day:</strong> {Math.round(result.budget.totals.paxDay).toLocaleString()} pax</div>}
                {result.budget.totals && <div><strong>Total daily margin (demo):</strong> ${Math.round(result.budget.totals.marginDay).toLocaleString()}</div>}
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
