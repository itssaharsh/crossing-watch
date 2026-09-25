# ADR 004: Real JKUAT data by default, a labelled simulation as fallback

**Decision.** The default series is the JHUB Conduit station at JKUAT (6–24 Mar 2026), ingested with `npm run data:ingest`. If that file is absent, the app uses a seeded simulated series that is always labelled "Simulated gauge series".

**Findings that shaped the importer.**
- The station's `rg1` column sums to 10.6 mm over the file, while its running daily total `rg1tt` gives 179.4 mm. We read rain from the daily total's increments (it resets at ~09:05 EAT; the station firmware rolls the day over at 06:00 UTC).
- Gauge 2's daily total rises in daylight and falls at night, going backwards 375 times: it tracks the visible-light sensor (r = 0.9999 with `si1145_vis`). The parser catches this from the backward moves alone, marks the gauge unreliable and never uses it, not even to fill gaps.
- 62.8 mm fell in the 18 h before the file starts (from the first daily total). It is counted as rain already in each bucket.
- Logger timestamps drift a few seconds per reading; rain is spread over the 15-min steps each interval overlaps.

**Why a fallback at all.** The demo must run with no file and no keys, and the simulated series plants one of each fault (spike, gap, clogged gauge, outage) so the quality checks can be shown working.
