# Forge design notes (box archive, 2026-11-25)

Working notes and reviews that lived on the build box and were not previously in this repository. They are historical (many are frozen at 4.9.229 or earlier) and are not the live app contract. The live app and simulators stay under `source/`.

- `AIWEB_FRAMEWORK_MAP.md` — AI.Web / Forge / Gilligan / Athena / Neo / RPMC full framework map.
- `ATHENA_DOC_TOOLS.md` — Athena Doc tools and features list.
- `BUILD_MAP.md` — Forge Mobile forward build map, written 2026-10-30.
- `ENGINE_AUDIT.md` — Audit of Nic's engines versus what Forge Mobile runs.
- `ENGINE_LIST.md` — List of every engine, module, and mechanism.
- `GILLIGAN_FRAMEWORK_MAP.md` — Gilligan framework map into Forge RPMC / no-LLM.
- `PROTOFORGE_DEF.md` — ProtoForge definition, from sources only.
- `REMODEL_PLAN.md` — Plan to clean the Forge Mobile core around rmc_engine_v1.
- `WORLD_MODEL_FINDINGS.md` — World-model material found in Nic's docs and repos.
- `dream-state-engine-brief-v2.md` — Dream State / Autonomic Growth Engine research brief v2.
- `dream-state-engine-brief.md` — Dream State Engine build brief (research only).
- `forge_changes_since_204.md` — What changed after 4.9.204 (PR #134) and why.
- `forge_layer_chain_229.md` — Forge Mobile 4.9.229 layer chain, traced in code.
- `forge_overview_229.md` — Forge Mobile overview at 4.9.229 (read-only review, 2026-11-05).
- `hfield-review-REPORT_NOTES.md` — hfield / PCI Ch.11 review notes (2026-11-25, read-only).
- `living_world_model_research.md` — Living world model: prior art and design gaps.
- `m_spc_findings.md` — M (μ) and SPC decay λ findings (read-only search, 2026-10-30).
- `phase_frequency_review.md` — Phase + frequency packet design review.

Box folders that were not copied here, and why:

- `aiweb-research/`, `oq-research/repos/`, and `mea-research/` are clones of repos already on GitHub (including this one) plus Identity Vault / HCS / Echo-Forge trees. They are not unique Forge Mobile notes.
- `oq-research/drivetxt/` and `hfield-review/` book or Drive extracts (`doc.docx`, `book*.txt`, `hcs.*`, `protoforge_pma*`, `yes.*`, `ch11.txt`, `dense_*`) are Nic's own documents, not app source.
- `hfield-review/hcs-repo/` is a clone of Harmonic Conductor Studio.
- Numbered `cs41xx` / build / step scratch folders, logs, and venvs were already used to ship app versions or are throwaway.
