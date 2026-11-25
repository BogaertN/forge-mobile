use hfield_domain::FieldScore;
use hfield_packet::validate_hfield_packet_contract;

const READER_JSON: &str = include_str!("../../../projects/hcs_canonical_reader_packet_v1.hfield");

fn active_note_count(score: &FieldScore, time_ms: u32) -> usize {
    score
        .music
        .tracks
        .iter()
        .flat_map(|track| &track.notes)
        .filter(|note| time_ms >= note.start_ms && time_ms < note.start_ms + note.duration_ms)
        .count()
}

#[test]
fn canonical_reader_asset_opens_and_validates() {
    let score: FieldScore =
        serde_json::from_str(READER_JSON).expect("canonical reader .hfield must parse");

    let report = validate_hfield_packet_contract(&score);
    assert!(
        report.fatal_errors.is_empty(),
        "canonical reader .hfield must have no fatal packet errors: {:?}",
        report.fatal_errors
    );

    assert_eq!(score.title, "AI.Web HFIELD Canonical Reader Packet v1");
    assert_eq!(
        score.provenance.artifact_id,
        "aiweb.hfield.reader_packet.canonical_v1"
    );
    assert_eq!(
        score.packet.phase_profile.phase_order,
        vec![2, 1, 3, 4, 5, 6, 7, 9, 8]
    );

    assert!(score
        .packet
        .payload_layers
        .iter()
        .any(|layer| layer == "file_identity_carrier"));
    assert!(score
        .packet
        .payload_layers
        .iter()
        .any(|layer| layer == "runtime_path_carriers"));
    assert!(score
        .packet
        .payload_layers
        .iter()
        .any(|layer| layer == "temporal_cymatic_reader"));

    assert_eq!(active_note_count(&score, 1000), 1);
    assert_eq!(active_note_count(&score, 3000), 2);
    assert_eq!(active_note_count(&score, 5000), 3);
    assert_eq!(active_note_count(&score, 7000), 3);

    assert!(!score.title.contains("Ode"));
}
