
# Quick Check — Line-Based Model
- Choose a service area. We evaluate pre-defined **lines** (multi-stop corridors), not all OD pairs.
- Each line's cycle time = round-trip travel time + dwell at stops.
- Demand comes from selected OD pairs on the line (hub-to-stops & adjacent stops by default).
- We compute **peak segment load** to size trips/day and **vessels needed** per line.
- Phase 1: recommend total fleet (sum across lines + reserve). Phase 2: optional budget allocation across lines.
- Replace: `DISTANCES` with NOAA tables and `DEMAND` with TranStats-driven values.
