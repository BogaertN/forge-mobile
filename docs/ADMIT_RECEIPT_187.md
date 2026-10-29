# Admit receipt — proposal, not shipped

The database cannot see that the admit gate ran. `app.memory_writer_insert` checks the shape of an admitted row: kind `fact`, state `admitted`, `sfe {Phi, eps, mu}` with ε at or under 0.35 and μ above 0, a provenance object, contributor credit, a hash, and a signature. A client that already holds those fields can present them. The function does not recompute C, Echo, or drift.

A server-verifiable receipt would have to be produced by a component the database trusts, and checked before insert:

- hash of the question and of the spoken sentence
- C, Echo, and ε as measured, plus the threshold snapshot (`C_min` 0.87, Echo 0.85, drift 0.35, hard stop 0.80)
- the engine build id
- a signature from a key the database holds, not from the phone

That checker is not in this release. Shipping a function that treats a client-supplied C as proof would look like verification and would not be one. The insert stays a shape check. The trace on the phone records the gate. The hosted row is still only an admitted fact with a packet, provenance, and contributor credit.
