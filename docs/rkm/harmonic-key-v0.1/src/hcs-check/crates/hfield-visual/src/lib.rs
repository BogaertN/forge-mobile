use hfield_conductor::gesture_definition;
use hfield_domain::{FieldScore, GestureEvent};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConductorMotionReport {
    pub strategy: String,
    pub track_id: String,
    pub event_count: usize,
    pub total_duration_ms: u32,
    pub total_duration_seconds: f64,
    pub event_views: Vec<ConductorMotionEventView>,
    pub sampled_points: Vec<ConductorMotionPoint>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConductorMotionEventView {
    pub event_index: usize,
    pub gesture_id: String,
    pub gesture_name: String,
    pub operator: Option<String>,
    pub field_region: String,
    pub anchor: String,
    pub start_ms: u32,
    pub duration_ms: u32,
    pub end_ms: u32,
    pub start_seconds: f64,
    pub duration_seconds: f64,
    pub start_x: f32,
    pub start_y: f32,
    pub target_x: f32,
    pub target_y: f32,
    pub intensity: f32,
    pub motion_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConductorMotionPoint {
    pub time_ms: u32,
    pub time_seconds: f64,
    pub x: f32,
    pub y: f32,
    pub gesture_id: String,
    pub event_index: usize,
    pub field_region: String,
    pub intensity: f32,
}

#[derive(Debug, Clone)]
struct VisualPosition {
    x: f32,
    y: f32,
    field_region: String,
    anchor: String,
}

pub fn create_conductor_motion_report(score: &FieldScore) -> ConductorMotionReport {
    let events = score
        .conductor
        .primary_hand_track
        .events
        .iter()
        .enumerate()
        .map(|(index, event)| build_event_view(index, event, previous_target(score, index)))
        .collect::<Vec<_>>();

    let total_duration_ms = events.iter().map(|event| event.end_ms).max().unwrap_or(0);
    let sampled_points = sample_motion_points(&events);

    let mut warnings = Vec::new();
    if events.is_empty() {
        warnings.push("No conductor events are available for visible motion.".to_string());
    }

    ConductorMotionReport {
        strategy: "nine_gesture_field_motion_v1".to_string(),
        track_id: score.conductor.primary_hand_track.track_id.clone(),
        event_count: events.len(),
        total_duration_ms,
        total_duration_seconds: round3(total_duration_ms as f64 / 1000.0),
        event_views: events,
        sampled_points,
        warnings,
    }
}

fn previous_target(score: &FieldScore, index: usize) -> VisualPosition {
    if index == 0 {
        score
            .conductor
            .primary_hand_track
            .events
            .get(index)
            .map(|event| gesture_position(&event.gesture_id))
            .unwrap_or_else(center_position)
    } else {
        score
            .conductor
            .primary_hand_track
            .events
            .get(index - 1)
            .map(|event| gesture_position(&event.gesture_id))
            .unwrap_or_else(center_position)
    }
}

fn build_event_view(
    index: usize,
    event: &GestureEvent,
    previous_position: VisualPosition,
) -> ConductorMotionEventView {
    let target = gesture_position(&event.gesture_id);
    let definition = gesture_definition(&event.gesture_id);

    let gesture_name = definition
        .as_ref()
        .map(|definition| definition.name.to_string())
        .unwrap_or_else(|| "Unknown Gesture".to_string());

    let end_ms = event.start_ms.saturating_add(event.duration_ms);

    ConductorMotionEventView {
        event_index: index + 1,
        gesture_id: event.gesture_id.clone(),
        gesture_name: gesture_name.clone(),
        operator: event.operator.clone(),
        field_region: target.field_region.clone(),
        anchor: target.anchor.clone(),
        start_ms: event.start_ms,
        duration_ms: event.duration_ms,
        end_ms,
        start_seconds: round3(event.start_ms as f64 / 1000.0),
        duration_seconds: round3(event.duration_ms as f64 / 1000.0),
        start_x: previous_position.x,
        start_y: previous_position.y,
        target_x: target.x,
        target_y: target.y,
        intensity: event.intensity,
        motion_label: motion_label(&event.gesture_id, &gesture_name, event.operator.as_deref()),
    }
}

fn sample_motion_points(events: &[ConductorMotionEventView]) -> Vec<ConductorMotionPoint> {
    let step_ms = 120_u32;
    let mut points = Vec::new();

    for event in events {
        let sample_count = (event.duration_ms / step_ms).max(1);

        for sample_index in 0..=sample_count {
            let local_ms = sample_index.saturating_mul(step_ms).min(event.duration_ms);

            let progress = if event.duration_ms == 0 {
                1.0
            } else {
                local_ms as f32 / event.duration_ms as f32
            };

            let eased = smoothstep(progress);
            let x = lerp(event.start_x, event.target_x, eased);
            let y = lerp(event.start_y, event.target_y, eased);
            let time_ms = event.start_ms.saturating_add(local_ms);

            points.push(ConductorMotionPoint {
                time_ms,
                time_seconds: round3(time_ms as f64 / 1000.0),
                x,
                y,
                gesture_id: event.gesture_id.clone(),
                event_index: event.event_index,
                field_region: event.field_region.clone(),
                intensity: event.intensity,
            });
        }
    }

    points.sort_by_key(|point| (point.time_ms, point.event_index));
    points
}

fn gesture_position(gesture_id: &str) -> VisualPosition {
    match gesture_id {
        "g7" => VisualPosition {
            x: 0.35,
            y: 0.18,
            field_region: "upper".to_string(),
            anchor: "anchor_9".to_string(),
        },
        "g9" => VisualPosition {
            x: 0.50,
            y: 0.15,
            field_region: "upper".to_string(),
            anchor: "anchor_9".to_string(),
        },
        "g8" => VisualPosition {
            x: 0.65,
            y: 0.18,
            field_region: "upper".to_string(),
            anchor: "anchor_9".to_string(),
        },
        "g2" => VisualPosition {
            x: 0.35,
            y: 0.50,
            field_region: "center".to_string(),
            anchor: "anchor_1".to_string(),
        },
        "g1" => VisualPosition {
            x: 0.50,
            y: 0.50,
            field_region: "center".to_string(),
            anchor: "anchor_1".to_string(),
        },
        "g3" => VisualPosition {
            x: 0.65,
            y: 0.50,
            field_region: "center".to_string(),
            anchor: "anchor_1".to_string(),
        },
        "g4" => VisualPosition {
            x: 0.35,
            y: 0.82,
            field_region: "lower".to_string(),
            anchor: "anchor_5".to_string(),
        },
        "g5" => VisualPosition {
            x: 0.50,
            y: 0.85,
            field_region: "lower".to_string(),
            anchor: "anchor_5".to_string(),
        },
        "g6" => VisualPosition {
            x: 0.65,
            y: 0.82,
            field_region: "lower".to_string(),
            anchor: "anchor_5".to_string(),
        },
        _ => center_position(),
    }
}

fn center_position() -> VisualPosition {
    VisualPosition {
        x: 0.50,
        y: 0.50,
        field_region: "center".to_string(),
        anchor: "anchor_1".to_string(),
    }
}

fn motion_label(gesture_id: &str, gesture_name: &str, operator: Option<&str>) -> String {
    let operator = operator.unwrap_or("gesture");

    match gesture_id {
        "g2" => format!("{operator}: prepare motion toward {gesture_name}."),
        "g1" => format!("{operator}: settle into {gesture_name}."),
        "g3" => format!("{operator}: open outward through {gesture_name}."),
        "g4" => format!("{operator}: descend through {gesture_name}."),
        "g5" => format!("{operator}: hold weight in {gesture_name}."),
        "g6" => format!("{operator}: release upward from {gesture_name}."),
        "g7" => format!("{operator}: gather lift into {gesture_name}."),
        "g9" => format!("{operator}: sustain upper expression in {gesture_name}."),
        "g8" => format!("{operator}: emit/release through {gesture_name}."),
        _ => format!("{operator}: move through {gesture_name}."),
    }
}

fn smoothstep(value: f32) -> f32 {
    let x = value.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

fn lerp(start: f32, end: f32, amount: f32) -> f32 {
    start + (end - start) * amount
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::{FieldScore, GestureEvent};

    #[test]
    fn creates_motion_report_from_default_score() {
        let score = FieldScore::default_hcs();
        let report = create_conductor_motion_report(&score);

        assert_eq!(report.track_id, "primary_hand");
        assert_eq!(report.event_count, 3);
        assert!(report.total_duration_ms > 0);
        assert!(!report.sampled_points.is_empty());
    }

    #[test]
    fn mapped_gestures_have_expected_regions() {
        let mut score = FieldScore::default_hcs();

        score.conductor.primary_hand_track.events = vec![
            GestureEvent {
                gesture_id: "g2".to_string(),
                start_ms: 0,
                duration_ms: 500,
                intensity: 0.5,
                operator: Some("prepare".to_string()),
            },
            GestureEvent {
                gesture_id: "g9".to_string(),
                start_ms: 500,
                duration_ms: 500,
                intensity: 0.7,
                operator: Some("upper_hold".to_string()),
            },
            GestureEvent {
                gesture_id: "g5".to_string(),
                start_ms: 1000,
                duration_ms: 500,
                intensity: 0.7,
                operator: Some("depth_hold".to_string()),
            },
        ];

        let report = create_conductor_motion_report(&score);
        let regions = report
            .event_views
            .iter()
            .map(|event| event.field_region.as_str())
            .collect::<Vec<_>>();

        assert_eq!(regions, vec!["center", "upper", "lower"]);
        assert_eq!(report.total_duration_ms, 1500);
    }

    #[test]
    fn empty_track_reports_warning() {
        let mut score = FieldScore::default_hcs();
        score.conductor.primary_hand_track.events.clear();

        let report = create_conductor_motion_report(&score);

        assert_eq!(report.event_count, 0);
        assert_eq!(report.total_duration_ms, 0);
        assert!(!report.warnings.is_empty());
    }
}
