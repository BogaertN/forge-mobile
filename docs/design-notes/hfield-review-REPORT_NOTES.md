# hfield / PCI Ch.11 review (2026-11-25, read-only)
Sources on box: doc.docx/book.txt (attached PCI book), ch11.txt, hcs.txt (HCS Google Doc export), yes.txt, protoforge_pma_*.txt, hcs-repo/ (git clone of BogaertN/harmonic-conductor-studio @0f2af29).
Key findings:
- .hfield defined in code: crates/hfield-domain FieldScore {format,version,packet,provenance,title,root_frequency_hz,anchors,gesture_vocabulary,coupling_profile,music,conductor}; canonical file projects/hcs_canonical_reader_packet_v1.hfield (v0.1.0).
- Identity carrier freq = blake3(artifact_id|title|format|version|kind|role) -> 96..2000 Hz (hash, not semantics).
- forge-bridge crate = stub, reference_only_no_live_forge_execution.
- Ch11 math issue: 144/432/1296 Hz all realign every 1/144 s (6.94 ms), not first at 187.5 ms. RS(9,7) corrects 1 error or 2 erasures.
- Anchor ratio inconsistency: doc v1 example 1/3/9; canonical file 1/0.5/3.
