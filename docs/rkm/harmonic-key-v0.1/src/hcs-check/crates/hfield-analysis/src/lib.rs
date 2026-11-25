use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WaveformSummary {
    pub sample_count: usize,
    pub peak_abs: f32,
    pub rms: f32,
}

pub fn summarize_waveform(samples: &[f32]) -> WaveformSummary {
    if samples.is_empty() {
        return WaveformSummary {
            sample_count: 0,
            peak_abs: 0.0,
            rms: 0.0,
        };
    }

    let mut peak_abs = 0.0_f32;
    let mut sum_squares = 0.0_f64;

    for sample in samples {
        peak_abs = peak_abs.max(sample.abs());
        sum_squares += (*sample as f64) * (*sample as f64);
    }

    WaveformSummary {
        sample_count: samples.len(),
        peak_abs,
        rms: (sum_squares / samples.len() as f64).sqrt() as f32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summarizes_basic_waveform() {
        let summary = summarize_waveform(&[0.0, 0.5, -1.0, 0.25]);
        assert_eq!(summary.sample_count, 4);
        assert_eq!(summary.peak_abs, 1.0);
        assert!(summary.rms > 0.0);
    }
}
