use hfield_domain::FieldScore;
#[cfg(test)]
use hfield_domain::HFIELD_VERSION;
use hfield_storage::{score_hash_hex, score_to_pretty_json};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use hfield_packet::{
    assert_hfield_packet_openable, canonicalize_hfield_score, canonicalized_hfield_score,
    validate_hfield_packet_contract, HfieldCanonicalizationReport,
};
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectFileReport {
    pub status: String,
    pub action: String,
    pub project_dir: String,
    pub file_name: String,
    pub path: String,
    pub bytes: u64,
    pub file_hash: String,
    pub score_hash: String,
    pub title: String,
    pub format: String,
    pub version: String,
    pub packet_status: String,
    pub packet_contract_id: String,
    pub migration_status: String,
    pub migration_changed_fields: Vec<String>,
    pub canonical_hash: String,
    pub fatal_errors: Vec<String>,
    pub note_count: usize,
    pub conductor_event_count: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectListReport {
    pub status: String,
    pub project_dir: String,
    pub project_count: usize,
    pub projects: Vec<ProjectSummary>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectSummary {
    pub file_name: String,
    pub path: String,
    pub bytes: u64,
    pub modified_unix_seconds: Option<u64>,
    pub title: Option<String>,
    pub score_hash: Option<String>,
    pub note_count: Option<usize>,
    pub conductor_event_count: Option<usize>,
    pub warnings: Vec<String>,
}

pub fn project_dir_for_app(app_root: &Path) -> PathBuf {
    app_root.join("projects")
}

pub fn sanitize_hfield_file_name(input: &str) -> Result<String, String> {
    let trimmed = input.trim();

    let candidate = if trimmed.is_empty() {
        "untitled_hcs_project.hfield".to_string()
    } else {
        trimmed.replace(' ', "_")
    };

    if candidate.contains('/') || candidate.contains('\\') {
        return Err("project filename must not contain path separators".to_string());
    }

    if candidate == "." || candidate == ".." {
        return Err("project filename must not be a relative path marker".to_string());
    }

    if candidate.len() > 128 {
        return Err("project filename is too long; maximum is 128 characters".to_string());
    }

    let mut file_name = candidate;

    if !file_name.ends_with(".hfield") {
        if file_name.contains('.') {
            return Err("project filename must end with .hfield".to_string());
        }

        file_name.push_str(".hfield");
    }

    let valid_chars = file_name
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.');

    if !valid_chars {
        return Err(
            "project filename may only contain letters, numbers, underscores, hyphens, and dots"
                .to_string(),
        );
    }

    Ok(file_name)
}

pub fn save_hfield_project(
    app_root: &Path,
    file_name_input: &str,
    score: &FieldScore,
) -> Result<ProjectFileReport, String> {
    let file_name = sanitize_hfield_file_name(file_name_input)?;
    let project_dir = project_dir_for_app(app_root);
    std::fs::create_dir_all(&project_dir)
        .map_err(|err| format!("failed to create project directory: {err}"))?;

    let (canonical_score, migration_report) = canonicalized_hfield_score(score);
    assert_hfield_packet_openable(&canonical_score)?;
    let warnings = validate_score(&canonical_score);
    let json = score_to_pretty_json(&canonical_score)
        .map_err(|err| format!("failed to serialize canonical .hfield JSON: {err}"))?;

    let path = project_dir.join(&file_name);
    std::fs::write(&path, json.as_bytes())
        .map_err(|err| format!("failed to write canonical .hfield project: {err}"))?;

    create_file_report(
        "save",
        &project_dir,
        &file_name,
        &path,
        &canonical_score,
        warnings,
        migration_report,
    )
}

pub fn open_hfield_project(
    app_root: &Path,
    file_name_input: &str,
) -> Result<(FieldScore, ProjectFileReport), String> {
    let file_name = sanitize_hfield_file_name(file_name_input)?;
    let project_dir = project_dir_for_app(app_root);
    let path = project_dir.join(&file_name);

    let json = std::fs::read_to_string(&path)
        .map_err(|err| format!("failed to read .hfield project: {err}"))?;

    let mut score: FieldScore = serde_json::from_str(&json)
        .map_err(|err| format!("failed to parse .hfield project JSON: {err}"))?;

    let migration_report = canonicalize_hfield_score(&mut score);
    assert_hfield_packet_openable(&score)?;
    let warnings = validate_score(&score);
    let report = create_file_report(
        "open",
        &project_dir,
        &file_name,
        &path,
        &score,
        warnings,
        migration_report,
    )?;

    Ok((score, report))
}

pub fn list_hfield_projects(app_root: &Path) -> Result<ProjectListReport, String> {
    let project_dir = project_dir_for_app(app_root);
    std::fs::create_dir_all(&project_dir)
        .map_err(|err| format!("failed to create project directory: {err}"))?;

    let mut projects = Vec::new();

    for entry in std::fs::read_dir(&project_dir)
        .map_err(|err| format!("failed to read project directory: {err}"))?
    {
        let entry =
            entry.map_err(|err| format!("failed to read project directory entry: {err}"))?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        if path.extension().and_then(|value| value.to_str()) != Some("hfield") {
            continue;
        }

        projects.push(create_project_summary(&path));
    }

    projects.sort_by(|left, right| left.file_name.cmp(&right.file_name));

    let project_count = projects.len();

    Ok(ProjectListReport {
        status: "ok".to_string(),
        project_dir: project_dir.to_string_lossy().to_string(),
        project_count,
        projects,
        warnings: Vec::new(),
    })
}

fn create_project_summary(path: &Path) -> ProjectSummary {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("unknown.hfield")
        .to_string();

    let metadata = std::fs::metadata(path);
    let bytes = metadata.as_ref().map(|meta| meta.len()).unwrap_or(0);

    let modified_unix_seconds = metadata
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs());

    let mut warnings = Vec::new();

    let parsed = std::fs::read_to_string(path)
        .map_err(|err| format!("read failed: {err}"))
        .and_then(|text| {
            serde_json::from_str::<FieldScore>(&text).map_err(|err| format!("parse failed: {err}"))
        });

    match parsed {
        Ok(score) => {
            warnings.extend(validate_score(&score));

            ProjectSummary {
                file_name,
                path: path.to_string_lossy().to_string(),
                bytes,
                modified_unix_seconds,
                title: Some(score.title.clone()),
                score_hash: score_hash_hex(&score).ok(),
                note_count: Some(note_count(&score)),
                conductor_event_count: Some(conductor_event_count(&score)),
                warnings,
            }
        }
        Err(err) => {
            warnings.push(err);

            ProjectSummary {
                file_name,
                path: path.to_string_lossy().to_string(),
                bytes,
                modified_unix_seconds,
                title: None,
                score_hash: None,
                note_count: None,
                conductor_event_count: None,
                warnings,
            }
        }
    }
}

fn create_file_report(
    action: &str,
    project_dir: &Path,
    file_name: &str,
    path: &Path,
    score: &FieldScore,
    warnings: Vec<String>,
    migration_report: HfieldCanonicalizationReport,
) -> Result<ProjectFileReport, String> {
    let metadata = std::fs::metadata(path)
        .map_err(|err| format!("failed to stat .hfield project file: {err}"))?;
    let bytes = metadata.len();

    let file_bytes = std::fs::read(path)
        .map_err(|err| format!("failed to read .hfield project file for hash: {err}"))?;

    let file_hash = blake3::hash(&file_bytes).to_hex().to_string();
    let score_hash =
        score_hash_hex(score).map_err(|err| format!("failed to hash .hfield score: {err}"))?;
    let packet_report = validate_hfield_packet_contract(score);

    Ok(ProjectFileReport {
        status: "ok".to_string(),
        action: action.to_string(),
        project_dir: project_dir.to_string_lossy().to_string(),
        file_name: file_name.to_string(),
        path: path.to_string_lossy().to_string(),
        bytes,
        file_hash,
        score_hash,
        title: score.title.clone(),
        format: score.format.clone(),
        version: score.version.clone(),
        packet_status: packet_report.status,
        packet_contract_id: packet_report.contract_id,
        migration_status: migration_report.status,
        migration_changed_fields: migration_report.changed_fields,
        canonical_hash: migration_report.after_hash,
        fatal_errors: packet_report.fatal_errors,
        note_count: note_count(score),
        conductor_event_count: conductor_event_count(score),
        warnings,
    })
}

fn validate_score(score: &FieldScore) -> Vec<String> {
    let mut warnings = Vec::new();
    let packet_report = validate_hfield_packet_contract(score);
    warnings.extend(packet_report.warnings.clone());
    warnings.extend(
        packet_report
            .fatal_errors
            .iter()
            .map(|error| format!("fatal packet error: {error}")),
    );

    if score.format != "aiweb.hfield" {
        warnings.push(format!("unexpected format: {}", score.format));
    }

    if score.version.trim().is_empty() {
        warnings.push("score version is empty".to_string());
    }

    if score.title.trim().is_empty() {
        warnings.push("score title is empty".to_string());
    }

    if score.music.tracks.is_empty() {
        warnings.push("music track list is empty".to_string());
    }

    if note_count(score) == 0 {
        warnings.push("score contains no music notes".to_string());
    }

    if score
        .conductor
        .primary_hand_track
        .track_id
        .trim()
        .is_empty()
    {
        warnings.push("primary conductor track id is empty".to_string());
    }

    if conductor_event_count(score) == 0 {
        warnings.push("score contains no conductor events".to_string());
    }

    for track in &score.music.tracks {
        if track.track_id.trim().is_empty() {
            warnings.push("music track contains an empty track id".to_string());
        }

        for note in &track.notes {
            if note.duration_ms == 0 {
                warnings.push(format!(
                    "track {} contains a zero-duration note at {} ms",
                    track.track_id, note.start_ms
                ));
            }
        }
    }

    for event in &score.conductor.primary_hand_track.events {
        if event.duration_ms == 0 {
            warnings.push(format!(
                "conductor gesture {} at {} ms has zero duration",
                event.gesture_id, event.start_ms
            ));
        }
    }

    warnings
}

fn note_count(score: &FieldScore) -> usize {
    score
        .music
        .tracks
        .iter()
        .map(|track| track.notes.len())
        .sum()
}

fn conductor_event_count(score: &FieldScore) -> usize {
    score.conductor.primary_hand_track.events.len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use hfield_domain::FieldScore;

    #[test]
    fn sanitizes_safe_file_names() {
        assert_eq!(
            sanitize_hfield_file_name("ode project").expect("sanitize"),
            "ode_project.hfield"
        );
        assert_eq!(
            sanitize_hfield_file_name("mapped.hfield").expect("sanitize"),
            "mapped.hfield"
        );
    }

    #[test]
    fn rejects_unsafe_file_names() {
        assert!(sanitize_hfield_file_name("../bad.hfield").is_err());
        assert!(sanitize_hfield_file_name("bad/name.hfield").is_err());
        assert!(sanitize_hfield_file_name("bad$name.hfield").is_err());
        assert!(sanitize_hfield_file_name("bad.txt").is_err());
    }

    #[test]
    fn validates_empty_default_score_with_warnings() {
        let score = FieldScore::default_hcs();
        let warnings = validate_score(&score);

        assert!(warnings
            .iter()
            .any(|warning| warning.contains("no music notes")));
    }

    #[test]
    fn opens_legacy_project_with_canonical_migration() {
        let root =
            std::env::temp_dir().join(format!("hcs_project_migration_test_{}", std::process::id()));

        if root.exists() {
            std::fs::remove_dir_all(&root).expect("clean old migration root");
        }

        let project_dir = project_dir_for_app(&root);
        std::fs::create_dir_all(&project_dir).expect("create project dir");

        let mut legacy_score = FieldScore::default_hcs();
        legacy_score.title = "Legacy Project".to_string();
        legacy_score.version = "0.0.1".to_string();
        legacy_score.packet.payload_layers.clear();
        legacy_score.packet.render_targets.clear();
        legacy_score.packet.target_systems.clear();
        legacy_score.provenance.artifact_id = "hfield_artifact_unbound".to_string();
        legacy_score.provenance.provenance_hash = None;

        let path = project_dir.join("legacy_project.hfield");
        std::fs::write(
            &path,
            serde_json::to_string_pretty(&legacy_score).expect("serialize legacy"),
        )
        .expect("write legacy");

        let (opened, report) =
            open_hfield_project(&root, "legacy_project.hfield").expect("open legacy");

        assert_eq!(opened.version, HFIELD_VERSION);
        assert!(opened.packet.target_systems.contains(&"HCS".to_string()));
        assert!(opened.packet.target_systems.contains(&"Forge".to_string()));
        assert!(opened
            .packet
            .payload_layers
            .contains(&"identity_provenance".to_string()));
        assert!(opened.provenance.provenance_hash.is_some());
        assert_eq!(report.migration_status, "changed");
        assert!(report
            .migration_changed_fields
            .iter()
            .any(|field| field == "version"));

        std::fs::remove_dir_all(&root).expect("remove migration root");
    }

    #[test]
    fn saves_lists_and_opens_project() {
        let root = std::env::temp_dir().join(format!("hcs_project_test_{}", std::process::id()));

        if root.exists() {
            std::fs::remove_dir_all(&root).expect("clean old root");
        }

        let mut score = FieldScore::default_hcs();
        score.title = "Project Test".to_string();

        let saved = save_hfield_project(&root, "project_test.hfield", &score).expect("save");
        assert_eq!(saved.status, "ok");
        assert_eq!(saved.file_name, "project_test.hfield");

        let listed = list_hfield_projects(&root).expect("list");
        assert_eq!(listed.project_count, 1);

        let (opened, opened_report) =
            open_hfield_project(&root, "project_test.hfield").expect("open");

        assert_eq!(opened.title, "Project Test");
        assert_eq!(opened_report.action, "open");

        std::fs::remove_dir_all(&root).expect("remove test root");
    }
}
