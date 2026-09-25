# ADR 002: A rain bucket per crossing and a Bayesian trigger, not a trained classifier

**Decision.** Each crossing has an antecedent-precipitation "bucket" with its own half-life (how fast it drains), and a flood trigger θ in mm learned as a grid posterior (2–150 mm) from dated reports.

**Why.** The data is one gauge and a handful of reports, and it may cover a single storm. A classifier would overfit instantly. The bucket is a standard hydrology index, and the posterior (a) works from a sensible prior with zero reports, (b) says how unsure it is (the band), and (c) updates with every tap in microseconds on a phone. A "clear" report at 19 mm and a "flooded" one at 36 mm literally bracket the trigger, which judges and riders can see on the depth post.

**Revisit when.** Several storms of reports exist per crossing: then learn the half-life too, and add a delayed (two-reservoir) response for river bridges.
