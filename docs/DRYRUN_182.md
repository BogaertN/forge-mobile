# Dry runs 4.9.182b

The same 60 questions ran through `rmc_engine_v1.rmc_core.run` in Pyodide in the Forge Mobile Ask screen and in python3. The browser path is the Pyodide worker (`path: pyodide`). The dry-run card on Ask is not the Ask reply. The existing JS engines still speak the reply.

## What was compared

For each question the browser trace and the python3 trace were compared on stage id, status, and reason; drift; coherence C; echo score, method, and pass; admit disposition; phase; and recall count and source. Timestamps and temporary receipt paths are not part of the comparison. Memory ids include the temp directory, so they differ on every run and are not a mismatch.

**Result: 60 of 60 match.** No stage status differs. No measured number differs.

## How the browser run was made to match

Two faults showed up before the match.

1. The worker fetched `data/py/rmc_engine_bundle.json` as a relative URL. A worker resolves that against `src/py_worker.js`, so the request was `/src/data/py/rmc_engine_bundle.json` and returned 404. The client then POSTed `/api/rmc/deep-dry-run`. The static server answered 501. That fallback has no stage card. The client now passes an absolute bundle URL. A worker failure is logged before the fallback.
2. The bundle contained only the Python modules. The dry run also reads `rmc_engine_v1/reference/` (phase codex, letter map, and the jsonl lexicons). Without those files, Pyodide quartz drift was 0.167473 and C was 0.722542. python3, which could read the files, reported 0.170806 and 0.721942. The bundle now includes the reference JSON, JSONL, and markdown. After that, quartz and the other 59 questions match.

## Echo

Echo ≥ 0.85 measures how closely the output reflects the original question. Method: `jaccard_content_tokens`. Content tokens are length greater than 2, with a small stopword list removed. The score is the Jaccard overlap of the selected candidate meaning and the question. Field `compares` is `selected_candidate_meaning_to_original_question`.

Stages 14–16 are still skipped, so the renderer does not run and there is no spoken sentence to score. The output meaning used here is the selected candidate text. On every question that text is:

> Preserve the active input event, phase path, drift report, and memory links as the next candidate meaning state.

That sentence shares no content token with any of the 60 questions, so echo is 0.0 and fails the 0.85 bar. That is the measurement, not a pass.

## Admit, route, recall

Admit stays `held` on every question because C is below C_min 0.87. C ranges from 0.629505 to 0.728041. Drift ranges from 0.167473 to 0.188393, under the 0.35 quarantine band and under the 0.80 hard stop, so drift is not why the gate holds. Route is `spc_cold_storage_required` on every question. `product_reply` is false. The admit decision is recorded and is not applied to Ask.

The shared memory fixture is one receipt, one phone row, and one hosted row. All three are written into the recaller receipt directory, so the recall source is `ingestion_receipt` with count 3 on every question. Phase is Φ1 on 57 questions. The three why-questions (sky, leaves, ocean) are Φ4. Phase is ok on all 60.

## Stages

All 16 stages ran on every question. Statuses did not vary.

| n | stage | status |
|---|---|---|
| 1 | `input_event` | OK |
| 2 | `memory_recall_trace_spine` | OK |
| 3 | `phase_parser` | OK |
| 4 | `structural_drift_engine` | OK |
| 5 | `protoforge2_drift_adapter` | OK |
| 6 | `candidate_generator` | OK |
| 7 | `evolutionary_drift_explorer` | OK |
| 8 | `coherence_scorer` | OK |
| 9 | `containment_router` | OK |
| 10 | `chi_correction_gate_preview` | OK |
| 11 | `storage_target_preview` | OK |
| 12 | `resurrection_eligibility_preview` | OK |
| 13 | `manifest_eligibility_check` | OK |
| 14 | `output_renderer_eligibility_check` | SKIPPED · renderer_not_executed_in_patch271_dry_run |
| 15 | `echo_validation_eligibility_check` | SKIPPED · echo_not_executed_in_patch271_dry_run |
| 16 | `memory_write_eligibility_check` | SKIPPED · memory_write_not_executed_in_patch271_dry_run |

Stages 14–16 are skipped by the dry-run orchestrator:

- 14 `output_renderer_eligibility_check` — `renderer_not_executed_in_patch271_dry_run`
- 15 `echo_validation_eligibility_check` — `echo_not_executed_in_patch271_dry_run`
- 16 `memory_write_eligibility_check` — `memory_write_not_executed_in_patch271_dry_run`

## Per question

Stages are `1–13 OK, 14–16 SKIPPED` on every row. Recall is `ingestion_receipt` × 3. Echo is 0.0 fail. Admit is held. Route is `spc_cold_storage_required`. The browser value and the python3 value are the same number.

| # | topic | question | phase | drift | C | echo | admit | recall |
|---|---|---|---|---:|---:|---|---|---|
| 1 | fact | What is quartz? | Φ1 | 0.170806 | 0.721942 | 0.0 fail | held | 3 ingestion_receipt |
| 2 | fact | What is photosynthesis? | Φ1 | 0.171638 | 0.728041 | 0.0 fail | held | 3 ingestion_receipt |
| 3 | why | Why is the sky blue? | Φ4 | 0.186617 | 0.631912 | 0.0 fail | held | 3 ingestion_receipt |
| 4 | fact | What is DNA? | Φ1 | 0.171214 | 0.721869 | 0.0 fail | held | 3 ingestion_receipt |
| 5 | fact | What is gravity? | Φ1 | 0.172433 | 0.721650 | 0.0 fail | held | 3 ingestion_receipt |
| 6 | how | How hot is the sun? | Φ1 | 0.172102 | 0.721084 | 0.0 fail | held | 3 ingestion_receipt |
| 7 | how | How do lightbulbs work? | Φ1 | 0.171847 | 0.718631 | 0.0 fail | held | 3 ingestion_receipt |
| 8 | how | How does a compass work? | Φ1 | 0.173028 | 0.718418 | 0.0 fail | held | 3 ingestion_receipt |
| 9 | how | How is glass made? | Φ1 | 0.171618 | 0.721796 | 0.0 fail | held | 3 ingestion_receipt |
| 10 | who | Who was Ada Lovelace? | Φ1 | 0.171376 | 0.718716 | 0.0 fail | held | 3 ingestion_receipt |
| 11 | when | When did the French Revolution begin? | Φ1 | 0.188393 | 0.715653 | 0.0 fail | held | 3 ingestion_receipt |
| 12 | who | Who painted the Mona Lisa? | Φ1 | 0.174057 | 0.718233 | 0.0 fail | held | 3 ingestion_receipt |
| 13 | fact | What is the capital of Japan? | Φ1 | 0.176289 | 0.719913 | 0.0 fail | held | 3 ingestion_receipt |
| 14 | fact | What is the largest planet? | Φ1 | 0.172314 | 0.721046 | 0.0 fail | held | 3 ingestion_receipt |
| 15 | math | What is 17 times 23? | Φ1 | 0.170909 | 0.721299 | 0.0 fail | held | 3 ingestion_receipt |
| 16 | math | What is the square root of 144? | Φ1 | 0.187885 | 0.717531 | 0.0 fail | held | 3 ingestion_receipt |
| 17 | fact | What is the boiling point of water? | Φ1 | 0.173904 | 0.720047 | 0.0 fail | held | 3 ingestion_receipt |
| 18 | fact | What is the speed of light? | Φ1 | 0.171757 | 0.724892 | 0.0 fail | held | 3 ingestion_receipt |
| 19 | safety | What happens if you mix bleach and ammonia? | Φ1 | 0.180478 | 0.718639 | 0.0 fail | held | 3 ingestion_receipt |
| 20 | fact | What happened in the news today? | Φ1 | 0.176620 | 0.719854 | 0.0 fail | held | 3 ingestion_receipt |
| 21 | self | How are you? | Φ1 | 0.171291 | 0.718731 | 0.0 fail | held | 3 ingestion_receipt |
| 22 | nonsense | Help | Φ1 | 0.167473 | 0.719418 | 0.0 fail | held | 3 ingestion_receipt |
| 23 | nonsense | Tell me about it | Φ1 | 0.172809 | 0.718458 | 0.0 fail | held | 3 ingestion_receipt |
| 24 | fact | What gas does photosynthesis release? | Φ1 | 0.185337 | 0.721201 | 0.0 fail | held | 3 ingestion_receipt |
| 25 | name | What is protoforge? | Φ1 | 0.170615 | 0.725101 | 0.0 fail | held | 3 ingestion_receipt |
| 26 | fact | And what about Mars? | Φ1 | 0.172473 | 0.721642 | 0.0 fail | held | 3 ingestion_receipt |
| 27 | fact | What is helium? | Φ1 | 0.171876 | 0.721750 | 0.0 fail | held | 3 ingestion_receipt |
| 28 | fact | What is a magnet? | Φ1 | 0.172421 | 0.721652 | 0.0 fail | held | 3 ingestion_receipt |
| 29 | fact | What is an atom? | Φ1 | 0.172623 | 0.721615 | 0.0 fail | held | 3 ingestion_receipt |
| 30 | fact | What is lightning? | Φ1 | 0.173764 | 0.721410 | 0.0 fail | held | 3 ingestion_receipt |
| 31 | fact | What is the Moon? | Φ1 | 0.170667 | 0.721967 | 0.0 fail | held | 3 ingestion_receipt |
| 32 | how | How does a battery work? | Φ1 | 0.172433 | 0.718526 | 0.0 fail | held | 3 ingestion_receipt |
| 33 | why | Why do leaves change color? | Φ4 | 0.186101 | 0.629505 | 0.0 fail | held | 3 ingestion_receipt |
| 34 | who | Who was Marie Curie? | Φ1 | 0.173276 | 0.718374 | 0.0 fail | held | 3 ingestion_receipt |
| 35 | who | Who wrote Hamlet? | Φ1 | 0.170780 | 0.718823 | 0.0 fail | held | 3 ingestion_receipt |
| 36 | when | When was the telephone invented? | Φ1 | 0.180448 | 0.717083 | 0.0 fail | held | 3 ingestion_receipt |
| 37 | fact | What is the capital of Canada? | Φ1 | 0.178653 | 0.719488 | 0.0 fail | held | 3 ingestion_receipt |
| 38 | fact | What is the longest river? | Φ1 | 0.172187 | 0.721069 | 0.0 fail | held | 3 ingestion_receipt |
| 39 | fact | What is Mount Everest? | Φ1 | 0.173968 | 0.721373 | 0.0 fail | held | 3 ingestion_receipt |
| 40 | math | What is 19 times 21? | Φ1 | 0.170909 | 0.721299 | 0.0 fail | held | 3 ingestion_receipt |
| 41 | math | What is 144 divided by 12? | Φ1 | 0.173700 | 0.720379 | 0.0 fail | held | 3 ingestion_receipt |
| 42 | fact | How many meters are in a kilometer? | Φ1 | 0.179593 | 0.719318 | 0.0 fail | held | 3 ingestion_receipt |
| 43 | fact | What is the freezing point of water? | Φ1 | 0.173138 | 0.720185 | 0.0 fail | held | 3 ingestion_receipt |
| 44 | safety | What happens if you mix bleach and vinegar? | Φ1 | 0.179126 | 0.718883 | 0.0 fail | held | 3 ingestion_receipt |
| 45 | how | How does a refrigerator work? | Φ1 | 0.173709 | 0.718296 | 0.0 fail | held | 3 ingestion_receipt |
| 46 | how | How is paper made? | Φ1 | 0.172314 | 0.721671 | 0.0 fail | held | 3 ingestion_receipt |
| 47 | name | What is Forge Mobile? | Φ1 | 0.186877 | 0.719050 | 0.0 fail | held | 3 ingestion_receipt |
| 48 | self | What can you do? | Φ1 | 0.169731 | 0.719012 | 0.0 fail | held | 3 ingestion_receipt |
| 49 | nonsense | Hello | Φ1 | 0.169638 | 0.719029 | 0.0 fail | held | 3 ingestion_receipt |
| 50 | fact | What is Saturn? | Φ1 | 0.170972 | 0.721912 | 0.0 fail | held | 3 ingestion_receipt |
| 51 | fact | What is rust? | Φ1 | 0.169947 | 0.722097 | 0.0 fail | held | 3 ingestion_receipt |
| 52 | fact | What is oxygen? | Φ1 | 0.169830 | 0.722118 | 0.0 fail | held | 3 ingestion_receipt |
| 53 | fact | What is a volcano? | Φ1 | 0.172818 | 0.721580 | 0.0 fail | held | 3 ingestion_receipt |
| 54 | why | Why is the ocean salty? | Φ4 | 0.185723 | 0.632073 | 0.0 fail | held | 3 ingestion_receipt |
| 55 | who | Who was Cleopatra? | Φ1 | 0.171555 | 0.718684 | 0.0 fail | held | 3 ingestion_receipt |
| 56 | when | When did World War II end? | Φ1 | 0.173063 | 0.718412 | 0.0 fail | held | 3 ingestion_receipt |
| 57 | fact | What is the capital of Australia? | Φ1 | 0.179258 | 0.719379 | 0.0 fail | held | 3 ingestion_receipt |
| 58 | fact | What is the Nile? | Φ1 | 0.171638 | 0.721793 | 0.0 fail | held | 3 ingestion_receipt |
| 59 | nonsense | Blargh floople zig? | Φ1 | 0.174087 | 0.718228 | 0.0 fail | held | 3 ingestion_receipt |
| 60 | math | What is 100 divided by 4? | Φ1 | 0.173700 | 0.720797 | 0.0 fail | held | 3 ingestion_receipt |

## Browser and python3 diff

| check | questions | match |
|---|---:|---|
| stage id, status, reason (16 stages) | 60 | yes |
| drift | 60 | yes |
| coherence C | 60 | yes |
| echo score, method, pass | 60 | yes |
| admit disposition | 60 | yes |
| phase primary and path | 60 | yes |
| recall count and source | 60 | yes |
| late-stage skip reasons | 60 | yes |

Nothing in the measured card differed. The Ask sentence on screen is still the JS reply and was not part of this diff. After that match, the seam's reported count was pointed at the recalled count, so both sides read 3 with this fixture. Drift, C, the 16 stage statuses, echo, admit, phase, and recall do not depend on that count.

## Next layer, left for 184

`src/next_layer.js` holds two switches, both default on so the current screens and tests keep their behavior.

- `dream_idle` explores novel ideas from cold storage. The Custody tab is this mesh. Packs stay gated.
- `economy` credits each KB contributor so a false entry traces to whoever added it. It counts provenance. It does not move money. Money stays disabled.

The world-model seam between recall and the admit gate is applied false. It reports the recalled count on both sides (3 and 3 with this fixture) and does not change it. It does not write and it does not call a model. Two notes are stored on the seam and are not implemented:

- Self-facts live in the world model and are evolvable. Self-extension is a core function.
- The world-model contract is Nic's design. It is rebuilt from his own docs in 184. This seam is not that contract.

## Questions

The list and the memory fixture are `source/tools/dryrun_182_questions.json`.

