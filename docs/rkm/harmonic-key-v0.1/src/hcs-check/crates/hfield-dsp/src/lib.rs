use hfield_domain::{FieldScore, GestureEvent, MusicTrack, NoteEvent};
use serde::{Deserialize, Serialize};
use std::f32::consts::TAU;

#[derive(Debug, Clone, PartialEq)]
pub struct CompiledAudio {
    pub sample_rate_hz: u32,
    pub samples: Vec<f32>,
}

pub const DETERMINISTIC_AUDIO_ENGINE_V2_CONTRACT_ID: &str =
    "aiweb.hfield.deterministic_audio_engine.v2";
pub const DETERMINISTIC_AUDIO_ENGINE_V2_PROFILE_ID: &str = "deterministic_music_gesture_mix_v2";

#[derive(Debug, Clone)]
pub struct DeterministicAudioEngineV2Render {
    pub compiled: CompiledAudio,
    pub report: DeterministicAudioEngineV2Report,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterministicAudioEngineV2Report {
    pub status: &'static str,
    pub contract_id: &'static str,
    pub profile_id: &'static str,
    pub engine_role: &'static str,
    pub sample_rate_hz: u32,
    pub deterministic_policy: DeterministicAudioPolicy,
    pub authority_boundaries: DeterministicAudioAuthorityBoundaries,
    pub source_inventory: DeterministicAudioSourceInventory,
    pub render_plan: Vec<DeterministicAudioRenderLayer>,
    pub output_summary: DeterministicAudioOutputSummary,
    pub readiness_gates: DeterministicAudioReadinessGates,
    pub open_source_dependency_policy: DeterministicAudioOpenSourcePolicy,
    pub next_work: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterministicAudioPolicy {
    pub no_randomness: bool,
    pub no_wall_clock_input: bool,
    pub no_device_input_for_render: bool,
    pub fixed_sample_timebase: bool,
    pub score_order_is_render_order: bool,
    pub finite_sample_gate: bool,
    pub safety_limiter_peak: f32,
    pub hash_algorithm: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterministicAudioAuthorityBoundaries {
    pub audio_is_rendering: bool,
    pub harmonic_field_score_remains_source: bool,
    pub audio_hash_is_artifact_receipt: bool,
    pub audio_hash_is_source_hash: bool,
    pub open_source_audio_tools_may_encode_or_analyze: bool,
    pub open_source_audio_tools_are_source_authority: bool,
    pub mutates_forge: bool,
    pub performs_identity_vault_write: bool,
    pub exports_private_identity: bool,
    pub authorizes_health_or_sensor_claims: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterministicAudioSourceInventory {
    pub title: String,
    pub format: String,
    pub version: String,
    pub coupling_profile: String,
    pub root_frequency_hz: f64,
    pub music_track_count: usize,
    pub note_count: usize,
    pub primary_gesture_event_count: usize,
    pub expressive_gesture_event_count: usize,
    pub total_duration_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterministicAudioRenderLayer {
    pub layer_id: &'static str,
    pub source_layer: &'static str,
    pub deterministic_rule: &'static str,
    pub gain: f32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterministicAudioOutputSummary {
    pub sample_count: usize,
    pub duration_seconds: f64,
    pub peak_abs: f32,
    pub rms: f32,
    pub nonzero_sample_count: usize,
    pub clipped_sample_count: usize,
    pub finite_sample_count: usize,
    pub pcm_i16_blake3_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterministicAudioReadinessGates {
    pub has_valid_sample_rate: bool,
    pub has_source_material: bool,
    pub has_supported_coupling_profile_reference: bool,
    pub output_is_nonempty: bool,
    pub output_samples_are_finite: bool,
    pub output_peak_within_limiter: bool,
    pub no_live_forge_or_identity_side_effects: bool,
    pub current_score_can_drive_deterministic_audio_v2: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeterministicAudioOpenSourcePolicy {
    pub principle: &'static str,
    pub allowed_roles: Vec<&'static str>,
    pub forbidden_roles: Vec<&'static str>,
    pub dependency_gates: Vec<&'static str>,
}

pub fn compile_deterministic_audio_engine_v2(
    score: &FieldScore,
    sample_rate_hz: u32,
) -> DeterministicAudioEngineV2Render {
    let safe_sample_rate_hz = sample_rate_hz.clamp(8_000, 192_000);
    let total_duration_ms = deterministic_audio_total_duration_ms(score).max(1);
    let total_samples = ms_to_samples(total_duration_ms, safe_sample_rate_hz).max(1);
    let mut samples = vec![0.0_f32; total_samples];

    render_music_layer_v2(score, safe_sample_rate_hz, &mut samples);
    render_gesture_layer_v2(score, safe_sample_rate_hz, &mut samples);
    deterministic_safety_limiter_v2(&mut samples);

    let compiled = CompiledAudio {
        sample_rate_hz: safe_sample_rate_hz,
        samples,
    };
    let report = create_deterministic_audio_engine_v2_report_from_compiled(score, &compiled);

    DeterministicAudioEngineV2Render { compiled, report }
}

pub fn create_deterministic_audio_engine_v2_report(
    score: &FieldScore,
    sample_rate_hz: u32,
) -> DeterministicAudioEngineV2Report {
    compile_deterministic_audio_engine_v2(score, sample_rate_hz).report
}

fn create_deterministic_audio_engine_v2_report_from_compiled(
    score: &FieldScore,
    compiled: &CompiledAudio,
) -> DeterministicAudioEngineV2Report {
    let output_summary =
        deterministic_audio_output_summary(&compiled.samples, compiled.sample_rate_hz);
    let source_inventory = deterministic_audio_source_inventory(score);
    let has_supported_coupling_profile_reference = score.coupling_profile == "pitch_preview_v1"
        || score.coupling_profile == "pitch_preview_v0";
    let has_source_material = source_inventory.note_count > 0
        || source_inventory.primary_gesture_event_count > 0
        || source_inventory.expressive_gesture_event_count > 0;
    let no_live_forge_or_identity_side_effects = score.packet.forge_bridge.status == "reserved"
        && score.packet.forge_bridge.forge_runtime_ref.is_none()
        && score.provenance.identity_vault.vault_record_ref.is_none()
        && !score.provenance.raw_private_identity_exported;
    let has_valid_sample_rate = (8_000..=192_000).contains(&compiled.sample_rate_hz);
    let output_samples_are_finite =
        output_summary.finite_sample_count == output_summary.sample_count;
    let output_peak_within_limiter = output_summary.peak_abs <= 0.800_001;
    let output_is_nonempty = output_summary.sample_count > 0;

    DeterministicAudioEngineV2Report {
        status: "ok",
        contract_id: DETERMINISTIC_AUDIO_ENGINE_V2_CONTRACT_ID,
        profile_id: DETERMINISTIC_AUDIO_ENGINE_V2_PROFILE_ID,
        engine_role: "replayable downstream audio rendering for Harmonic Field Score music and G1-G9 gesture source layers",
        sample_rate_hz: compiled.sample_rate_hz,
        deterministic_policy: DeterministicAudioPolicy {
            no_randomness: true,
            no_wall_clock_input: true,
            no_device_input_for_render: true,
            fixed_sample_timebase: true,
            score_order_is_render_order: true,
            finite_sample_gate: true,
            safety_limiter_peak: 0.80,
            hash_algorithm: "BLAKE3 over little-endian PCM i16 sample stream",
        },
        authority_boundaries: DeterministicAudioAuthorityBoundaries {
            audio_is_rendering: true,
            harmonic_field_score_remains_source: true,
            audio_hash_is_artifact_receipt: true,
            audio_hash_is_source_hash: false,
            open_source_audio_tools_may_encode_or_analyze: true,
            open_source_audio_tools_are_source_authority: false,
            mutates_forge: false,
            performs_identity_vault_write: false,
            exports_private_identity: false,
            authorizes_health_or_sensor_claims: false,
        },
        source_inventory,
        render_plan: deterministic_audio_render_plan(),
        output_summary,
        readiness_gates: DeterministicAudioReadinessGates {
            has_valid_sample_rate,
            has_source_material,
            has_supported_coupling_profile_reference,
            output_is_nonempty,
            output_samples_are_finite,
            output_peak_within_limiter,
            no_live_forge_or_identity_side_effects,
            current_score_can_drive_deterministic_audio_v2: has_valid_sample_rate
                && has_source_material
                && has_supported_coupling_profile_reference
                && output_is_nonempty
                && output_samples_are_finite
                && output_peak_within_limiter
                && no_live_forge_or_identity_side_effects,
        },
        open_source_dependency_policy: DeterministicAudioOpenSourcePolicy {
            principle: "Use mature open-source audio libraries for encoding, decoding, device playback, FFT, and file I/O, but never let them own Harmonic Field Score source truth or Forge authority.",
            allowed_roles: vec![
                "WAV_encoding",
                "MIDI_import_export_adapter",
                "audio_device_playback",
                "FFT_spectrum_analysis",
                "resampling_helper_after_receipt_gate",
                "loudness_metering_helper",
            ],
            forbidden_roles: vec![
                ".hfield_source_authority",
                "Harmonic_Field_Score_schema_authority",
                "Forge_authorization",
                "Identity_Vault_live_write",
                "private_identity_export",
                "health_or_sensor_claim_authority",
            ],
            dependency_gates: vec![
                "license_compatibility",
                "maintenance_activity",
                "local_first_no_cloud_required",
                "deterministic_render_path_or_recorded_nondeterminism",
                "no_hidden_data_collection",
                "no_authority_over_hfield_source_object",
            ],
        },
        next_work: vec![
            "bind deterministic audio v2 artifact hash into canonical bundle manifest v2",
            "add renderer replay verifier coverage for deterministic audio v2 WAV exports",
            "add optional open-source encoder evaluation packet before adopting any new dependency",
            "add stereo/spatial renderer only after mono deterministic receipt path is locked",
            "add operator-facing A/B comparison between legacy combined preview and deterministic audio v2",
        ],
    }
}

fn deterministic_audio_render_plan() -> Vec<DeterministicAudioRenderLayer> {
    vec![
        DeterministicAudioRenderLayer {
            layer_id: "music_fundamental_layer",
            source_layer: "musical_event_layer",
            deterministic_rule: "render each note in score order using fixed phase, fixed envelope, velocity clamp, and bounded additive harmonics",
            gain: 0.72,
            enabled: true,
        },
        DeterministicAudioRenderLayer {
            layer_id: "music_presence_harmonic_layer",
            source_layer: "musical_event_layer",
            deterministic_rule: "add quiet second harmonic from the same note event without randomized phase or device input",
            gain: 0.16,
            enabled: true,
        },
        DeterministicAudioRenderLayer {
            layer_id: "g1_g9_conductor_guide_layer",
            source_layer: "gesture_motion_layer",
            deterministic_rule: "render G1-G9 gesture tone guides from root-frequency ratios and gesture intensity",
            gain: 0.18,
            enabled: true,
        },
        DeterministicAudioRenderLayer {
            layer_id: "safety_limiter_layer",
            source_layer: "audio_rendering_policy",
            deterministic_rule: "scale once if peak exceeds 0.80, then clamp non-finite or unsafe samples into the receipt-safe range",
            gain: 0.80,
            enabled: true,
        },
    ]
}

fn render_music_layer_v2(score: &FieldScore, sample_rate_hz: u32, output: &mut [f32]) {
    for track in &score.music.tracks {
        let track_gain = deterministic_track_gain_v2(track.role.as_str());
        for note in &track.notes {
            render_note_event_v2(note, track_gain, sample_rate_hz, output);
        }
    }
}

fn deterministic_track_gain_v2(role: &str) -> f32 {
    match role {
        "melody" => 0.26,
        "bass_depth" => 0.20,
        "harmonic_field_support" => 0.11,
        _ => 0.15,
    }
}

fn render_note_event_v2(
    note: &NoteEvent,
    track_gain: f32,
    sample_rate_hz: u32,
    output: &mut [f32],
) {
    let start_sample = ms_to_samples(note.start_ms, sample_rate_hz);
    let note_samples = ms_to_samples(note.duration_ms, sample_rate_hz);
    if note_samples == 0 {
        return;
    }

    let frequency_hz = midi_note_to_frequency_hz(note.midi_note);
    let amplitude = (track_gain * note.velocity.clamp(0.0, 1.0)).clamp(0.0, 0.38);

    for n in 0..note_samples {
        let output_index = start_sample + n;
        if output_index >= output.len() {
            break;
        }

        let t = n as f32 / sample_rate_hz as f32;
        let envelope = deterministic_music_envelope_v2(n, note_samples);
        let fundamental = (TAU * frequency_hz * t).sin();
        let second_harmonic = 0.16 * (TAU * frequency_hz * 2.0 * t).sin();
        let octave_air = 0.05 * (TAU * frequency_hz * 4.0 * t).sin();

        output[output_index] += amplitude * envelope * (fundamental + second_harmonic + octave_air);
    }
}

fn render_gesture_layer_v2(score: &FieldScore, sample_rate_hz: u32, output: &mut [f32]) {
    for event in &score.conductor.primary_hand_track.events {
        render_gesture_event_v2(score, event, sample_rate_hz, output);
    }

    if let Some(track) = &score.conductor.expressive_hand_track {
        for event in &track.events {
            render_gesture_event_v2(score, event, sample_rate_hz, output);
        }
    }
}

fn render_gesture_event_v2(
    score: &FieldScore,
    event: &GestureEvent,
    sample_rate_hz: u32,
    output: &mut [f32],
) {
    let start_sample = ms_to_samples(event.start_ms, sample_rate_hz);
    let event_samples = ms_to_samples(event.duration_ms, sample_rate_hz);
    if event_samples == 0 {
        return;
    }

    let frequency_hz =
        gesture_frequency_hz(score.root_frequency_hz as f32, event.gesture_id.as_str());
    let amplitude = (0.05 + event.intensity * 0.15).clamp(0.0, 0.26);

    for n in 0..event_samples {
        let output_index = start_sample + n;
        if output_index >= output.len() {
            break;
        }

        let t = n as f32 / sample_rate_hz as f32;
        let envelope = deterministic_gesture_envelope_v2(n, event_samples);
        let carrier = (TAU * frequency_hz * t).sin();
        let low_presence = 0.08 * (TAU * frequency_hz * 0.5 * t).sin();

        output[output_index] += amplitude * envelope * (carrier + low_presence);
    }
}

fn deterministic_music_envelope_v2(sample_index: usize, total_samples: usize) -> f32 {
    if total_samples <= 1 {
        return 0.0;
    }

    let attack = (total_samples / 24).max(1);
    let release = (total_samples / 10).max(1);
    deterministic_linear_envelope(sample_index, total_samples, attack, release)
}

fn deterministic_gesture_envelope_v2(sample_index: usize, total_samples: usize) -> f32 {
    if total_samples <= 1 {
        return 0.0;
    }

    let attack = (total_samples / 12).max(1);
    let release = (total_samples / 9).max(1);
    deterministic_linear_envelope(sample_index, total_samples, attack, release)
}

fn deterministic_linear_envelope(
    sample_index: usize,
    total_samples: usize,
    attack: usize,
    release: usize,
) -> f32 {
    if sample_index < attack {
        sample_index as f32 / attack as f32
    } else if sample_index + release >= total_samples {
        let remaining = total_samples.saturating_sub(sample_index);
        remaining as f32 / release as f32
    } else {
        1.0
    }
    .clamp(0.0, 1.0)
}

fn deterministic_safety_limiter_v2(samples: &mut [f32]) {
    for sample in samples.iter_mut() {
        if !sample.is_finite() {
            *sample = 0.0;
        }
    }

    let peak = samples
        .iter()
        .fold(0.0_f32, |acc, sample| acc.max(sample.abs()));

    if peak > 0.80 {
        let scale = 0.80 / peak;
        for sample in samples.iter_mut() {
            *sample *= scale;
        }
    }

    for sample in samples.iter_mut() {
        *sample = sample.clamp(-0.80, 0.80);
    }
}

fn deterministic_audio_source_inventory(score: &FieldScore) -> DeterministicAudioSourceInventory {
    DeterministicAudioSourceInventory {
        title: score.title.clone(),
        format: score.format.clone(),
        version: score.version.clone(),
        coupling_profile: score.coupling_profile.clone(),
        root_frequency_hz: score.root_frequency_hz,
        music_track_count: score.music.tracks.len(),
        note_count: deterministic_audio_note_count(score),
        primary_gesture_event_count: score.conductor.primary_hand_track.events.len(),
        expressive_gesture_event_count: score
            .conductor
            .expressive_hand_track
            .as_ref()
            .map(|track| track.events.len())
            .unwrap_or(0),
        total_duration_ms: deterministic_audio_total_duration_ms(score),
    }
}

fn deterministic_audio_output_summary(
    samples: &[f32],
    sample_rate_hz: u32,
) -> DeterministicAudioOutputSummary {
    let mut peak_abs = 0.0_f32;
    let mut sum_squares = 0.0_f64;
    let mut nonzero_sample_count = 0usize;
    let mut clipped_sample_count = 0usize;
    let mut finite_sample_count = 0usize;

    for sample in samples {
        if sample.is_finite() {
            finite_sample_count += 1;
        }
        if sample.abs() > 0.000_001 {
            nonzero_sample_count += 1;
        }
        if sample.abs() > 0.800_001 {
            clipped_sample_count += 1;
        }
        peak_abs = peak_abs.max(sample.abs());
        sum_squares += (*sample as f64) * (*sample as f64);
    }

    let rms = if samples.is_empty() {
        0.0
    } else {
        (sum_squares / samples.len() as f64).sqrt() as f32
    };

    DeterministicAudioOutputSummary {
        sample_count: samples.len(),
        duration_seconds: if sample_rate_hz == 0 {
            0.0
        } else {
            samples.len() as f64 / sample_rate_hz as f64
        },
        peak_abs,
        rms,
        nonzero_sample_count,
        clipped_sample_count,
        finite_sample_count,
        pcm_i16_blake3_hash: deterministic_pcm_i16_blake3_hash(samples),
    }
}

fn deterministic_pcm_i16_blake3_hash(samples: &[f32]) -> String {
    let mut hasher = blake3::Hasher::new();
    for sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let value = (clamped * i16::MAX as f32).round() as i16;
        hasher.update(&value.to_le_bytes());
    }
    hasher.finalize().to_hex().to_string()
}

fn deterministic_audio_note_count(score: &FieldScore) -> usize {
    score
        .music
        .tracks
        .iter()
        .map(|track| track.notes.len())
        .sum()
}

fn deterministic_audio_total_duration_ms(score: &FieldScore) -> u32 {
    let note_max = score
        .music
        .tracks
        .iter()
        .flat_map(|track| track.notes.iter())
        .map(|note| note.start_ms.saturating_add(note.duration_ms))
        .max()
        .unwrap_or(0);
    let primary_max = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .map(|event| event.start_ms.saturating_add(event.duration_ms))
        .max()
        .unwrap_or(0);
    let expressive_max = score
        .conductor
        .expressive_hand_track
        .as_ref()
        .and_then(|track| {
            track
                .events
                .iter()
                .map(|event| event.start_ms.saturating_add(event.duration_ms))
                .max()
        })
        .unwrap_or(0);

    note_max.max(primary_max).max(expressive_max)
}

pub fn compile_pitch_preview(score: &FieldScore, sample_rate_hz: u32) -> CompiledAudio {
    let total_duration_ms = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .map(|event| event.start_ms + event.duration_ms)
        .max()
        .unwrap_or(0)
        .max(1);

    let total_samples = ms_to_samples(total_duration_ms, sample_rate_hz).max(1);
    let mut samples = vec![0.0_f32; total_samples];

    for event in &score.conductor.primary_hand_track.events {
        render_gesture_event(score, event, sample_rate_hz, &mut samples);
    }

    normalize_safety(&mut samples);

    CompiledAudio {
        sample_rate_hz,
        samples,
    }
}

pub fn compile_music_preview(score: &FieldScore, sample_rate_hz: u32) -> CompiledAudio {
    let total_duration_ms = score
        .music
        .tracks
        .iter()
        .flat_map(|track| track.notes.iter())
        .map(|note| note.start_ms + note.duration_ms)
        .max()
        .unwrap_or(0)
        .max(1);

    let total_samples = ms_to_samples(total_duration_ms, sample_rate_hz).max(1);
    let mut samples = vec![0.0_f32; total_samples];

    for track in &score.music.tracks {
        render_music_track(track, sample_rate_hz, &mut samples);
    }

    normalize_safety(&mut samples);

    CompiledAudio {
        sample_rate_hz,
        samples,
    }
}

pub fn compile_combined_music_and_conductor_preview(
    score: &FieldScore,
    sample_rate_hz: u32,
) -> CompiledAudio {
    let conductor = compile_pitch_preview(score, sample_rate_hz);
    let music = compile_music_preview(score, sample_rate_hz);
    let total_samples = conductor.samples.len().max(music.samples.len()).max(1);
    let mut samples = vec![0.0_f32; total_samples];

    for (idx, out) in samples.iter_mut().enumerate() {
        let music_sample = music.samples.get(idx).copied().unwrap_or(0.0);
        let conductor_sample = conductor.samples.get(idx).copied().unwrap_or(0.0);

        // Music is foreground. Conductor tone is quiet guidance for now.
        *out = (music_sample * 0.90) + (conductor_sample * 0.22);
    }

    normalize_safety(&mut samples);

    CompiledAudio {
        sample_rate_hz,
        samples,
    }
}

fn render_music_track(track: &MusicTrack, sample_rate_hz: u32, output: &mut [f32]) {
    let track_gain = match track.role.as_str() {
        "melody" => 0.22,
        "bass_depth" => 0.18,
        "harmonic_field_support" => 0.09,
        _ => 0.14,
    };

    for note in &track.notes {
        render_note_event(note, track_gain, sample_rate_hz, output);
    }
}

fn render_note_event(note: &NoteEvent, track_gain: f32, sample_rate_hz: u32, output: &mut [f32]) {
    let start_sample = ms_to_samples(note.start_ms, sample_rate_hz);
    let note_samples = ms_to_samples(note.duration_ms, sample_rate_hz);
    if note_samples == 0 {
        return;
    }

    let frequency_hz = midi_note_to_frequency_hz(note.midi_note);
    let amplitude = (track_gain * note.velocity.clamp(0.0, 1.0)).clamp(0.0, 0.35);

    for n in 0..note_samples {
        let output_index = start_sample + n;
        if output_index >= output.len() {
            break;
        }

        let t = n as f32 / sample_rate_hz as f32;
        let envelope = music_envelope(n, note_samples);

        // Simple musical tone v1: sine fundamental with a quiet second harmonic.
        let fundamental = (TAU * frequency_hz * t).sin();
        let second_harmonic = 0.18 * (TAU * frequency_hz * 2.0 * t).sin();

        output[output_index] += amplitude * envelope * (fundamental + second_harmonic);
    }
}

fn render_gesture_event(
    score: &FieldScore,
    event: &GestureEvent,
    sample_rate_hz: u32,
    output: &mut [f32],
) {
    let start_sample = ms_to_samples(event.start_ms, sample_rate_hz);
    let event_samples = ms_to_samples(event.duration_ms, sample_rate_hz);
    if event_samples == 0 {
        return;
    }

    let frequency_hz =
        gesture_frequency_hz(score.root_frequency_hz as f32, event.gesture_id.as_str());
    let amplitude = (0.08 + event.intensity * 0.18).clamp(0.0, 0.30);

    for n in 0..event_samples {
        let output_index = start_sample + n;
        if output_index >= output.len() {
            break;
        }

        let t = n as f32 / sample_rate_hz as f32;
        let envelope = smooth_envelope(n, event_samples);
        let value = amplitude * envelope * (TAU * frequency_hz * t).sin();

        output[output_index] += value;
    }
}

pub fn midi_note_to_frequency_hz(midi_note: u8) -> f32 {
    440.0 * 2.0_f32.powf((midi_note as f32 - 69.0) / 12.0)
}

pub fn gesture_frequency_hz(root_hz: f32, gesture_id: &str) -> f32 {
    match gesture_id {
        "g4" => root_hz * 0.625,
        "g5" => root_hz * 0.5,
        "g6" => root_hz * 0.75,
        "g2" => root_hz * 0.94,
        "g1" => root_hz,
        "g3" => root_hz * 1.06,
        "g7" => root_hz * 2.0,
        "g9" => root_hz * 3.0,
        "g8" => root_hz * 4.0,
        _ => root_hz,
    }
}

fn ms_to_samples(ms: u32, sample_rate_hz: u32) -> usize {
    ((ms as f64 / 1000.0) * sample_rate_hz as f64).round() as usize
}

fn smooth_envelope(sample_index: usize, total_samples: usize) -> f32 {
    if total_samples <= 1 {
        return 0.0;
    }

    let attack = (total_samples / 10).max(1);
    let release = (total_samples / 8).max(1);

    if sample_index < attack {
        sample_index as f32 / attack as f32
    } else if sample_index + release >= total_samples {
        let remaining = total_samples.saturating_sub(sample_index);
        remaining as f32 / release as f32
    } else {
        1.0
    }
    .clamp(0.0, 1.0)
}

fn music_envelope(sample_index: usize, total_samples: usize) -> f32 {
    if total_samples <= 1 {
        return 0.0;
    }

    let attack = (total_samples / 18).max(1);
    let release = (total_samples / 8).max(1);

    if sample_index < attack {
        sample_index as f32 / attack as f32
    } else if sample_index + release >= total_samples {
        let remaining = total_samples.saturating_sub(sample_index);
        remaining as f32 / release as f32
    } else {
        1.0
    }
    .clamp(0.0, 1.0)
}

fn normalize_safety(samples: &mut [f32]) {
    let peak = samples
        .iter()
        .fold(0.0_f32, |acc, sample| acc.max(sample.abs()));

    if peak > 0.80 {
        let scale = 0.80 / peak;
        for sample in samples.iter_mut() {
            *sample *= scale;
        }
    }

    for sample in samples {
        *sample = sample.clamp(-0.80, 0.80);
    }
}

pub fn write_wav_i16<P: AsRef<std::path::Path>>(
    path: P,
    compiled: &CompiledAudio,
) -> Result<(), hound::Error> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: compiled.sample_rate_hz,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::create(path, spec)?;

    for sample in &compiled.samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let value = (clamped * i16::MAX as f32).round() as i16;
        writer.write_sample(value)?;
    }

    writer.finalize()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, NoteEvent};

    #[test]
    fn compiles_default_score_to_audio_samples() {
        let score = FieldScore::default_hcs();
        let compiled = compile_pitch_preview(&score, 48_000);
        assert_eq!(compiled.sample_rate_hz, 48_000);
        assert!(!compiled.samples.is_empty());
        assert!(compiled.samples.iter().any(|sample| sample.abs() > 0.0001));
    }

    #[test]
    fn center_root_frequency_is_144() {
        assert_eq!(gesture_frequency_hz(144.0, "g1"), 144.0);
    }

    #[test]
    fn midi_a4_is_440_hz() {
        let a4 = midi_note_to_frequency_hz(69);
        assert!((a4 - 440.0).abs() < 0.001);
    }

    #[test]
    fn compiles_music_note_to_audio_samples() {
        let mut score = FieldScore::default_hcs();
        score.music.tracks[0].notes.push(NoteEvent {
            midi_note: 69,
            start_ms: 0,
            duration_ms: 500,
            velocity: 0.8,
        });

        let compiled = compile_music_preview(&score, 48_000);
        assert_eq!(compiled.sample_rate_hz, 48_000);
        assert!(!compiled.samples.is_empty());
        assert!(compiled.samples.iter().any(|sample| sample.abs() > 0.0001));
    }

    #[test]
    fn deterministic_audio_engine_v2_is_replayable_for_same_score() {
        let score = FieldScore::default_hcs();
        let first = compile_deterministic_audio_engine_v2(&score, 48_000);
        let second = compile_deterministic_audio_engine_v2(&score, 48_000);

        assert_eq!(first.compiled.sample_rate_hz, 48_000);
        assert_eq!(first.compiled.samples, second.compiled.samples);
        assert_eq!(
            first.report.output_summary.pcm_i16_blake3_hash,
            second.report.output_summary.pcm_i16_blake3_hash
        );
        assert_eq!(
            first.report.contract_id,
            DETERMINISTIC_AUDIO_ENGINE_V2_CONTRACT_ID
        );
        assert!(first.report.deterministic_policy.no_randomness);
        assert!(
            first
                .report
                .readiness_gates
                .current_score_can_drive_deterministic_audio_v2
        );
    }

    #[test]
    fn deterministic_audio_engine_v2_keeps_audio_downstream() {
        let score = FieldScore::default_hcs();
        let report = create_deterministic_audio_engine_v2_report(&score, 48_000);

        assert!(report.authority_boundaries.audio_is_rendering);
        assert!(
            report
                .authority_boundaries
                .harmonic_field_score_remains_source
        );
        assert!(report.authority_boundaries.audio_hash_is_artifact_receipt);
        assert!(!report.authority_boundaries.audio_hash_is_source_hash);
        assert!(
            !report
                .authority_boundaries
                .open_source_audio_tools_are_source_authority
        );
        assert!(!report.authority_boundaries.mutates_forge);
        assert!(!report.authority_boundaries.performs_identity_vault_write);
        assert!(!report.authority_boundaries.exports_private_identity);
        assert_eq!(report.output_summary.clipped_sample_count, 0);
        assert_eq!(
            report.output_summary.finite_sample_count,
            report.output_summary.sample_count
        );
    }

    #[test]
    fn writes_wav_file() {
        let score = FieldScore::default_hcs();
        let compiled = compile_pitch_preview(&score, 48_000);
        let path = std::env::temp_dir().join("hcs_test_preview.wav");
        write_wav_i16(&path, &compiled).expect("write wav");
        let metadata = std::fs::metadata(&path).expect("wav metadata");
        assert!(metadata.len() > 44);
        let _ = std::fs::remove_file(path);
    }
}
