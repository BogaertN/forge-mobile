"""RMC engine v1 package.

Patch 262J1R-Preflight-B: drift_engine extracted and rebuilt from design docs.

Module registry
---------------
phase_parser       — extracted Patch 262J1R-Preflight-A (no change this patch)
drift_engine       — NEW this patch: structural analysis, real epsilon_s computation
coherence_math     — extracted Patch 262I2, kernel fix Patch 262J1R-Preflight-A
manifest_compiler  — extracted Patch 262J, schema validation Patch 262J1R-Preflight-A

NOT YET EXTRACTED
-----------------
resonance_lexicon — Patch 262J1R-Preflight-B2 (gold reference foundation)
candidate_generator — Patch 262J1R-Preflight-C (after B2 verifies)
"""

ENGINE_PACKAGE_VERSION = "rmc_engine_v1_patch271_deep_dry_run_orchestrator"

FROZEN_LEGACY_EVIDENCE = {
    "rmc_engine_v1/llm_renderer.py": {
        "status": "withdrawn_frozen_evidence_only",
        "runtime_authorized": False,
        "import_authorized": False,
        "call_authorized": False,
        "capability_installed": False,
    },
    "rmc_engine_v1/chroma_connector.py": {
        "status": "withdrawn_frozen_evidence_only",
        "runtime_authorized": False,
        "import_authorized": False,
        "call_authorized": False,
        "capability_installed": False,
    },
}


MODULE_REGISTRY = {
    "phase_codex": {
        "module": "rmc_engine_v1.phase_codex",
        "extracted_patch": "262J1R-Preflight-B3",
        "status": "extracted",
        "engine_mode": "read_only_phase_codex_binding",
        "side_effect_free": True,
        "authority": "FBSC Phase Glyph Codex v2.5 / Rosetta Stone",
    },
    "phase_parser": {
        "module": "rmc_engine_v1.phase_parser",
        "extracted_patch": "262J1R-Preflight-A",
        "status": "extracted",
        "side_effect_free": True,
    },

    "resonance_lexicon": {
        "module": "rmc_engine_v1.resonance_lexicon",
        "extracted_patch": "262J1R-Preflight-B2",
        "updated_patch": "262J1R-Preflight-B3",
        "status": "extracted",
        "engine_mode": "read_only_resonance_lexicon_dry_run",
        "side_effect_free": True,
        "authority_hierarchy": [
            "letter_resonance_weak_signal",
            "word_loop_medium_signal",
            "phrase_operator_strong_signal",
            "sentence_transition_and_manifest_trace_final_authority",
        ],
    },
    "drift_engine": {
        "module": "rmc_engine_v1.drift_engine",
        "extracted_patch": "262J1R-Preflight-B",
        "updated_patch": "262J1R-Preflight-B2",
        "status": "extracted",
        "scoring_mode": "structural_contract_drift_analysis",
        "synthetic_taxonomy_mode": False,
        "side_effect_free": True,
        "design_sources": [
            "RMC Section 05.4 Drift Analyzer",
            "RMC Appendix C Drift Taxonomy",
            "RMC Section 06.3 Drift Functional",
        ],
    },
    "coherence_math": {
        "module": "rmc_engine_v1.coherence_math",
        "extracted_patch": "262I2",
        "updated_patch": "262J1R-Preflight-A",
        "status": "extracted",
        "side_effect_free": True,
    },
    "manifest_compiler": {
        "module": "rmc_engine_v1.manifest_compiler",
        "extracted_patch": "262J",
        "updated_patch": "262J1R-Preflight-A",
        "status": "extracted",
        "side_effect_free": True,
    },

    "active_loop_state": {
        "module": "rmc_engine_v1.active_loop_state",
        "extracted_patch": "262J1R-Preflight-C11",
        "status": "extracted",
        "engine_mode": "read_only_active_loop_state_reconstruction",
        "side_effect_free": True,
        "writes_files": False,
        "uses_llm": False,
        "queries_chroma": False,
        "purpose": "Reconstruct L_t from pipeline trace and RMC memory surface before gated persistence.",
    },


    "glyph_renderer": {
        "module": "rmc_engine_v1.glyph_renderer",
        "extracted_patch": "262J1R-Preflight-C14",
        "status": "extracted",
        "engine_mode": "deterministic_fbsc_glyph_packet_renderer",
        "side_effect_free": True,
        "writes_files": False,
        "uses_llm": False,
        "uses_image_model": False,
        "queries_chroma": False,
        "authority": "FBSC Phase Glyph Codex v2.5 deterministic SVG/JSON packet renderer",
        "purpose": "Render traceable G_t glyph packets from μ_t/phase paths before optional image-generation expansion.",
    },



    "promotion_path": {
        "module": "rmc_engine_v1.promotion_path",
        "extracted_patch": "262J1R-Preflight-C12",
        "status": "extracted",
        "engine_mode": "review_queue_to_stable_memory_promotion",
        "side_effect_free_preview": True,
        "writes_files_only_with_explicit_approval": True,
        "approval_token_required": "APPROVE_RMC_PROMOTION",
        "purpose": "Promote reviewed RMC dataset queue items into stable memory and retrieval indexes without mutating canonical references.",
    },

    "containment_router": {
        "module": "rmc_engine_v1.containment_router",
        "extracted_patch": "265R",
        "status": "extracted",
        "engine_mode": "containment_routing_hard_boundary_read_only",
        "side_effect_free": True,
        "sealed_routes": [
            "spc_cold_storage_required", "dream_state_quarantine_candidate",
            "drift_archive_only", "ghost_loop_containment_required",
        ],
    },

    "spc_cold_storage": {"module": "rmc_engine_v1.spc_cold_storage", "extracted_patch": "266R", "status": "extracted", "engine_mode": "spc_cold_storage_preview", "side_effect_free": True, "approval_token_commit": "APPROVE_SPC_WRITE"},

    "drift_archive": {"module": "rmc_engine_v1.drift_archive", "extracted_patch": "266R", "status": "extracted", "engine_mode": "drift_archive_diagnostic_only", "side_effect_free": True},

    "dream_state_quarantine": {"module": "rmc_engine_v1.dream_state_quarantine", "extracted_patch": "266R", "status": "extracted", "engine_mode": "dream_state_quarantine_speculative", "side_effect_free": True},

    "ghost_loop_containment": {"module": "rmc_engine_v1.ghost_loop_containment", "extracted_patch": "266R", "status": "extracted", "engine_mode": "ghost_loop_containment_system_capacity_failure", "side_effect_free": True},

    "chi_correction_gate": {"module": "rmc_engine_v1.chi_correction_gate", "extracted_patch": "267R", "status": "extracted", "engine_mode": "chi_t_correction_gate_preview", "side_effect_free": True},

    "protoforge2_drift_connector": {
        "module": "rmc_engine_v1.protoforge2_drift_connector",
        "extracted_patch": "268S3",
        "status": "extracted",
        "engine_mode": "protoforge2_drift_candidate_adapter",
        "side_effect_free": True,
        "safe_callables_ranked": ["DriftArbitrator.evaluate", "DriftBridge.evaluate"],
        "full_drift_monitor_not_called_by_default": True,
    },

    "resurrection_engine": {"module": "rmc_engine_v1.resurrection_engine", "extracted_patch": "269", "status": "extracted", "engine_mode": "christping_7gate_resurrection_preview_read_only", "side_effect_free": True},

    "deep_pipeline_preflight": {"module": "rmc_engine_v1.deep_pipeline_preflight", "extracted_patch": "270", "status": "extracted", "engine_mode": "deep_pipeline_integration_readiness_map_read_only", "side_effect_free": True},

    "deep_dry_run_orchestrator": {
        "module": "rmc_engine_v1.deep_dry_run_orchestrator",
        "extracted_patch": "271",
        "status": "extracted",
        "engine_mode": "read_only_deep_pipeline_dry_run_orchestration",
        "side_effect_free": True,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "queries_chroma_write": False,
        "calls_llm": False,
        "executes_shell": False,
        "purpose": "Exercise the installed deep RMC modules together in one read-only dry-run trace before live integration.",
    },
}

PLANNED_EXTRACTIONS = {
    "candidate_generator": {"planned_patch": "262J1R-Preflight-C"},
    "containment_routing": {"planned_patch": "262J1R"},
}
