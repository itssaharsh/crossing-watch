# ADR 001: The call is deterministic code, not a language model

**Decision.** Cross / wait / reroute is computed by plain, tested functions (`lib/model/decide.ts`). There is no LLM anywhere in the decision path.

**Why.** A rider acts on this call in the rain. It has to be reproducible, explainable in one sentence ("31 mm in the bucket; floods between 14 and 32 mm"), and safe by construction: a silent gauge can never produce CROSS, a fresh "flooded" report always forces at least WAIT. Those guarantees live in code and in `npm run verify`, not in a prompt.

**Cost.** No free-text reasoning in the UI. We don't need it: the depth post, the band and three "why" lines explain every call.
