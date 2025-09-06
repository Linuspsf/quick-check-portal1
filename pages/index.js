
import { useMemo, useState } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';

/** DEMO data (replace with NOAA + TranStats in production) */
const DISTANCES = {
  'Inside Passage (SE Alaska)': {
    ports: ['Juneau, AK','Haines, AK','Skagway, AK','Sitka, AK','Petersburg, AK','Wrangell, AK','Ketchikan, AK','Hoonah, AK'],
    nm: {
      'Juneau, AK': {'Haines, AK': 73, 'Skagway, AK': 94, 'Sitka, AK': 95, 'Petersburg, AK': 120, 'Wrangell, AK': 155, 'Ketchikan, AK': 235, 'Hoonah, AK': 33},
      'Haines, AK': {'Skagway, AK': 14, 'Petersburg, AK': 140},
      'Sitka, AK': {'Petersburg, AK': 109, 'Wrangell, AK': 144, 'Ketchikan, AK': 192},
      'Petersburg, AK': {'Wrangell, AK': 31, 'Ketchikan, AK': 116},
      'Wrangell, AK': {'Ketchikan, AK': 82},
    }
  }
};

const LINES = {
  'Inside Passage (SE Alaska)': [
    { id: 'JNU-HNS-SGY', name: 'Juneau—Haines—Skagway', color: '#ef4444', stops: ['Juneau, AK','Haines, AK','Skagway, AK'] },
    { id: 'JNU-SIT', name: 'Juneau—Sitka', color: '#7c3aed', stops: ['Juneau, AK','Sitka, AK'] },
    { id: 'JNU-PSG-WRG-KTN', name: 'Juneau—Petersburg—Wrangell—Ketchikan', color: '#10b981', stops: ['Juneau, AK','Petersburg, AK','Wrangell, AK','Ketchikan, AK'] },
    { id: 'JNU-HNH', name: 'Juneau—Hoonah', color: '#f59e0b', stops: ['Juneau, AK','Hoonah, AK'] },
  ]
};

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
};

function routeKey(a,b){ return a < b ? `${a} ⇄ ${b}` : `${b} ⇄ ${a}`; }
function nmBetween(nm, a, b){ return (nm[a] && nm[a][b]) || (nm[b] && nm[b][a]) || null; }

function lineSegments(stops, nm){
  const segs = [];
  for(let i=0;i<stops.length-1;i++){
    const a=stops[i], b=stops[i+1];
    const d = nmBetween(nm,a,b);
    if(d==null || d>500) return null;
    segs.push({a,b,nm:d});
  }
  return segs;
}

function pathBetween(stops, segs, a, b){
  const i = stops.indexOf(a), j = stops.indexOf(b);
  if(i===-1 || j===-1) return null;
  const low=Math.min(i,j), high=Math.max(i,j);
  return segs.slice(low, high);
}

function hoursToHHMM(h){
  const total = Math.round(h*60);
  const hh = Math.floor(total/60);
  const mm = total%60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

export default function Home(){
  const [area] = useState('Inside Passage (SE Alaska)');
  const [speed, setSpeed] = useState(75);
  const [opsHours, setOpsHours] = useState(12);
  const [dwellMin, setDwellMin] = useState(12);
  const [fare, setFare] = useState(120);
  const [loadFactor, setLoadFactor] = useState(0.75);
  const [costPerNm, setCostPerNm] = useState(8);
  const [reservePct, setReservePct] = useState(0.15);
  const [captureRate, setCaptureRate] = useState(0.25);
  const [budgetFleet, setBudgetFleet] = useState(4);
  const [result, setResult] = useState(null);

  const nmMatrix = DISTANCES[area].nm;
  const lines = LINES[area];

  const compute = () => {
    const effSeats = Math.floor(20 * loadFactor);
    const lineResults = [];
    for(const line of lines){
      const segs = lineSegments(line.stops, nmMatrix);
      if(!segs) continue;
      const oneWay = segs.reduce((s,sg)=> s + sg.nm/speed, 0);
      const callsPerRoundTrip = 2 * line.stops.length;
      const cycle = 2*oneWay + (callsPerRoundTrip * dwellMin/60);
      const tripsPerVesselPerDay = Math.max(0, Math.floor(opsHours / cycle));
      const paxPerTrip = effSeats;

      const segLoads = segs.map(sg => ({...sg, paxPerDay: 0}));
      let capturedTotalPerDay = 0;
      const candidatePairs = [];
      for(let i=0;i<line.stops.length-1;i++) candidatePairs.push(routeKey(line.stops[i], line.stops[i+1]));
      const hub = line.stops.find(s => /Juneau|Seattle|San Francisco|Chicago/.test(s));
      if(hub){ for(const s of line.stops){ if(s!==hub) candidatePairs.push(routeKey(hub, s)); } }

      for(const key of candidatePairs){
        const annual = DEMAND[key] ?? 0;
        if(!annual) continue;
        const captured = (annual * captureRate)/365;
        const [a,b] = key.split(' ⇄ ');
        const path = pathBetween(line.stops, segs, a, b);
        if(!path) continue;
        for(const p of path){
          const idx = segLoads.findIndex(sg => (sg.a===p.a && sg.b===p.b) || (sg.a===p.b && sg.b===p.a));
          if(idx>=0) segLoads[idx].paxPerDay += captured;
        }
        capturedTotalPerDay += captured;
      }
      const peakLoad = segLoads.reduce((m,sg)=> Math.max(m, sg.paxPerDay), 0);
      const tripsNeeded = Math.ceil(peakLoad / Math.max(paxPerTrip,1));
      const vesselsNeeded = tripsPerVesselPerDay>0 ? Math.ceil(tripsNeeded / tripsPerVesselPerDay) : Infinity;

      const lineNmRoundTrip = 2 * segs.reduce((s,sg)=> s + sg.nm, 0);
      const revenuePerTrip = fare * paxPerTrip;
      const variableCostPerTrip = costPerNm * lineNmRoundTrip;
      const marginPerTrip = revenuePerTrip - variableCostPerTrip;
      const marginPerVesselDay = marginPerTrip * tripsPerVesselPerDay;
      const marginPerHour = marginPerVesselDay / Math.max(opsHours,1);

      lineResults.push({ ...line, segs, cycleHours:cycle, tripsPerVesselPerDay, paxPerTrip, peakLoad, tripsNeeded, vesselsNeeded, marginPerVesselDay, marginPerHour, capturedTotalPerDay, lineNmRoundTrip });
    }

    const fleetRecommendedRaw = lineResults.reduce((s,r)=> s + (r.vesselsNeeded===Infinity?0:r.vesselsNeeded), 0);
    const fleetRecommended = Math.ceil(fleetRecommendedRaw * (1+reservePct));
    const capturedPaxDay = lineResults.reduce((s,r)=> s + r.capturedTotalPerDay, 0);

    // Phase 2: build cycle "jobs" to satisfy tripsNeeded for each line, then assign to N vessels
    let schedule = null;
    if(budgetFleet>0){
      // Create jobs: each job is one full line round trip
      const jobs = [];
      for(const r of lineResults){
        for(let k=0; k<r.tripsNeeded; k++){
          jobs.push({
            id: r.id + '-' + (k+1),
            lineId: r.id,
            lineName: r.name,
            color: r.color,
            duration: r.cycleHours,
            margin: r.marginPerVesselDay / Math.max(r.tripsPerVesselPerDay,1), // approx per cycle
            density: (r.marginPerVesselDay / Math.max(r.tripsPerVesselPerDay,1)) / r.cycleHours
          });
        }
      }
      // Sort jobs by value density desc (margin/hour)
      jobs.sort((a,b)=> b.density - a.density);

      const vessels = Array.from({length: budgetFleet}, (_,i)=>({ id: i+1, time: 0, plan: [] }));
      const dayLimit = opsHours;

      for(const job of jobs){
        // pick vessel that becomes available the earliest
        vessels.sort((a,b)=> a.time - b.time);
        const v = vessels[0];
        if(v.time + job.duration <= dayLimit){
          v.plan.push({ lineName: job.lineName, color: job.color, start: v.time, end: v.time + job.duration, duration: job.duration, margin: job.margin });
          v.time += job.duration;
        }
      }

      const allocationRows = [];
      let networkMargin = 0, networkPax = 0;
      for(const v of vessels){
        for(const leg of v.plan){
          networkMargin += leg.margin;
          // capacity per cycle = paxPerTrip; we don't have per-line here, estimate by duration mapping back
          const line = lineResults.find(l => l.name === leg.lineName);
          networkPax += line ? line.paxPerTrip : 0;
        }
      }
      schedule = { vessels, networkMargin, networkPax };
    }

    setResult({ lines: lineResults, fleetRecommended, fleetRecommendedRaw, capturedPaxDay, effSeats, schedule });
  };

  return (
    <div className="container">
      <Head><title>Pacific Seaflight Quick Check — Interlined Scheduler</title></Head>
      <div className="card">
        <h1 className="h1">Quick Check — Interlined (multi-line) day plan</h1>
        <p className="subtitle">We evaluate **lines** (e.g., Juneau—Haines—Skagway) and size fleet by peak segment load. If you enter a budgeted fleet, we interline cycles across lines to build a single-day plan per vessel (no “one vessel per pair”).</p>

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
            <label className="label">Capture rate of market</label>
            <input className="input" type="number" step="0.05" min="0.05" max="0.8" value={captureRate} onChange={e=>setCaptureRate(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Maintenance reserve (fraction)</label>
            <input className="input" type="number" step="0.05" min="0" max="0.5" value={reservePct} onChange={e=>setReservePct(Number(e.target.value))} />
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
            <label className="label">Budget: I can start with up to N vessels (interlining)</label>
            <input className="input" type="number" min="0" value={budgetFleet} onChange={e=>setBudgetFleet(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">&nbsp;</label>
            <button className="btn" onClick={compute}>Run Quick Check</button>
          </div>
        </div>

        <p className="small">Segments > 500 nm are excluded. Distances are nautical miles on safe navigable routes. Demo datasets shown.</p>
      </div>

      {result && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card">
          <h3>Phase 1 — Fleet needed to serve captured market (by line)</h3>
          <div className="grid3">
            <div className="stat"><div className="k">{result.lines.length}</div><div className="small">Lines evaluated</div></div>
            <div className="stat"><div className="k">{Math.ceil(result.fleetRecommended)}</div><div className="small">Recommended fleet (incl. reserve)</div></div>
            <div className="stat"><div className="k">{Math.round(result.capturedPaxDay).toLocaleString()}</div><div className="small">Captured pax/day</div></div>
          </div>
          <table className="table">
            <thead><tr><th>Line</th><th>Stops</th><th>Cycle (h)</th><th>Trips/vessel/day</th><th>Pax/trip</th><th>Peak seg load</th><th>Trips/day needed</th><th>Vessels needed</th></tr></thead>
            <tbody>
              {result.lines.map(r => (
                <tr key={r.id}>
                  <td><span className="badge" style={{background:r.color, color:'white', border:'none'}}>{r.name}</span></td>
                  <td>{r.stops.join(' → ')}</td>
                  <td>{r.cycleHours.toFixed(2)}</td>
                  <td>{r.tripsPerVesselPerDay}</td>
                  <td>{r.paxPerTrip}</td>
                  <td>{Math.ceil(r.peakLoad)}</td>
                  <td>{r.tripsNeeded}</td>
                  <td>{r.vesselsNeeded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {result && result.schedule && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card">
          <h3>Phase 2 — Interlined starter day plan ({result.schedule.vessels.length} vessels)</h3>
          <p className="small">Each cycle is an end-to-end round trip on a line. We assign the most valuable cycles first (margin/hour) while avoiding overlap on each vessel.</p>
          <div className="vesselGrid">
            {result.schedule.vessels.map(v => (
              <div key={v.id} style={{border:'1px solid #e5e7eb', borderRadius:12, padding:10, background:'#f8fafc'}}>
                <div style={{fontWeight:700, marginBottom:6}}>Vessel {v.id}</div>
                {v.plan.length===0 ? <div className="small">Idle</div> : v.plan.map((leg, i) => (
                  <div key={i} style={{marginBottom:6}}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span className="badge" style={{background:leg.color, color:'white', border:'none'}}>{leg.lineName}</span>
                      <span className="small">{hoursToHHMM(leg.start)}–{hoursToHHMM(leg.end)}</span>
                    </div>
                    <div className="small">Cycle {leg.duration.toFixed(2)} h • est. margin ${Math.round(leg.margin).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{display:'flex', gap:24, marginTop:10, flexWrap:'wrap'}}>
            <div><strong>Network capacity/day (approx cycles × pax/trip):</strong> {Math.round(result.schedule.networkPax).toLocaleString()} pax</div>
            <div><strong>Total daily margin (demo):</strong> ${Math.round(result.schedule.networkMargin).toLocaleString()}</div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
