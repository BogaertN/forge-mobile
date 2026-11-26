use hfield_domain::FieldScore;
use hfield_packet::validate_hfield_packet_contract;
use hfield_forge_bridge::create_forge_packet_bridge_stub_report;
#[test]
fn forge_example_packet_validates() {
    let text = std::fs::read_to_string("/workspace/forge-harmonic-key/example_forge_packet_v0.1.hfield").unwrap();
    let score: FieldScore = serde_json::from_str(&text).expect("deserialize FieldScore");
    let r = validate_hfield_packet_contract(&score);
    println!("PACKET status={} fatal={:?} warnings={:?}", r.status, r.fatal_errors, r.warnings);
    let b = create_forge_packet_bridge_stub_report(&score);
    println!("BRIDGE status={} fatal={:?} warnings={:?}", b.status, b.fatal_errors, b.warnings);
    assert!(r.fatal_errors.is_empty());
    assert!(b.fatal_errors.is_empty());
}
