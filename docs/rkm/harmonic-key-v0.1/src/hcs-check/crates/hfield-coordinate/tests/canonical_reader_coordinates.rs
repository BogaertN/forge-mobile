use hfield_coordinate::{
    build_harmonic_coordinate_registry, calculate_interference_eligibility, CoordinateLayer,
};
use hfield_domain::FieldScore;

const READER_JSON: &str = include_str!("../../../projects/hcs_canonical_reader_packet_v1.hfield");

#[test]
fn canonical_reader_coordinate_manifest_matches_reader_proof_windows() {
    let score: FieldScore =
        serde_json::from_str(READER_JSON).expect("canonical reader .hfield must parse");
    let registry = build_harmonic_coordinate_registry(&score);

    assert_eq!(
        registry.contract_id,
        "aiweb.hfield.harmonic_coordinate_registry.v1"
    );
    assert_eq!(registry.total_duration_ms, 8000);

    assert!(registry
        .entries
        .iter()
        .any(|entry| entry.layer == CoordinateLayer::FileIdentityCarrier));
    assert!(registry
        .entries
        .iter()
        .any(|entry| entry.note_name.as_deref() == Some("C4")));
    assert!(registry
        .entries
        .iter()
        .any(|entry| entry.note_name.as_deref() == Some("G4")));
    assert!(registry
        .entries
        .iter()
        .any(|entry| entry.note_name.as_deref() == Some("G3")));
    assert!(registry
        .entries
        .iter()
        .any(|entry| entry.note_name.as_deref() == Some("C5")));

    let interference = calculate_interference_eligibility(&registry);
    assert!(interference.iter().any(|entry| entry.eligible));
}
