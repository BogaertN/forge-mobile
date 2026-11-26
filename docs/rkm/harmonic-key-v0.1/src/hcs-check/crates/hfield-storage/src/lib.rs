use hfield_domain::FieldScore;

pub fn score_to_pretty_json(score: &FieldScore) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(score)
}

pub fn score_from_json(input: &str) -> Result<FieldScore, serde_json::Error> {
    serde_json::from_str(input)
}

pub fn score_hash_hex(score: &FieldScore) -> Result<String, serde_json::Error> {
    let json = serde_json::to_vec(score)?;
    Ok(blake3::hash(&json).to_hex().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_round_trips_json() {
        let score = FieldScore::default_hcs();
        let json = score_to_pretty_json(&score).expect("serialize score");
        let decoded = score_from_json(&json).expect("deserialize score");
        assert_eq!(score, decoded);
    }

    #[test]
    fn score_hash_is_stable_for_same_score() {
        let score = FieldScore::default_hcs();
        let hash_a = score_hash_hex(&score).expect("hash score");
        let hash_b = score_hash_hex(&score).expect("hash score");
        assert_eq!(hash_a, hash_b);
        assert_eq!(hash_a.len(), 64);
    }
}
