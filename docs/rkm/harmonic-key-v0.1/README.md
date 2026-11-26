# Forge Harmonic Key v0.1 (Resonant Key Memory)

Spec, research answers, numeric key matrix, and an example `.hfield` packet for the shared key that lets two Forges exchange memory over a speaker and microphone. These files were built on the box on 2026-11-25 and are archived here so they are not stranded offline.

Text versions are the source of truth in git. The original `.docx` and `.zip` stay off this commit because the upload path is text-only; the markdown, JSON, CSV, and `.hfield` cover the same content.

## Files

- `Forge_Harmonic_Key_and_Packet_Spec_v0.1.md` — packet and key specification.
- `Forge_Harmonic_Key_Open_Questions_Research_v0.1.md` — research decisions (bands, kāraka slots, atom ids, MAC, peer reinforcement).
- `forge_harmonic_key_v0.1.json` — numeric key matrix.
- `forge_harmonic_key_v0.1.csv` — the same matrix as a spreadsheet.
- `example_forge_packet_v0.1.hfield` — example packet.
- `rkm_build_prompt.txt` — prompt used to build RKM into Forge Mobile.
- `src/` — generators, computed matrix check, and an HCS crate subset used to validate the packet.

The live RKM implementation in the app is under `source/` / `preview/` (PREVIEW 4.9.250 RKM). Do not treat this folder as the running engine.
