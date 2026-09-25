# ADR 003: The model runs in the browser on bundled data

**Decision.** The station series, crossings, map geometry and seed reports ship as static JSON. All model maths runs client-side. The only server code is a tiny report store (`/api/reports`), a replay clock for phones in the room (`/api/clock`) and a LAN helper for the QR code.

**Why.** No loader on stage, no cold start, works offline and on a flaky venue network. Recomputing every crossing's calls for 1,824 steps after a tap takes well under 50 ms.

**Cost.** On serverless hosting the in-memory report store is per instance. That's fine for one presenter. A shared key-value store behind the same three functions is the swap for a real pilot.
