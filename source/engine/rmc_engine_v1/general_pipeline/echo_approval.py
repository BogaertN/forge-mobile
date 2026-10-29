"""General Learning-to-Answer Pipeline — Echo approval gate (Build GP-001).

Echo is the rendering approval gate. It checks that the rendered natural
language faithfully preserves the meaning manifest, and on PASS it APPROVES the
output for delivery in its permitted mode.

What Echo PASS means here:
  the spoken answer is faithful to the sealed meaning (the exact answer value,
  the verification, and the claim status all appear and none are upgraded).

What Echo PASS does NOT mean (locked, same as the RMC architecture):
  it does not certify external empirical truth, it does not write memory, it
  does not create CT, it does not change upstream claim status, it does not
  publish through any route or UI. Approval is of fidelity, not omniscience.

This corrects the Build 010 drift where Echo only reported eligibility. Here a
faithful rendering of a RESOLVED_MANIFEST is approved for delivery.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

from rmc_engine_v1.mea.manifest_schema import ClaimStatus

from .contracts import MeaningManifest, canonical_hash

# Words that would constitute an unsupported empirical upgrade if they appeared
# attached to the answer of a closed arithmetic problem.
_OVERCLAIM_TERMS = ("proven scientifically", "empirically confirmed", "proves that reality", "law of nature")


@dataclass
class EchoResult:
    approved_output: bool
    echo_status: str
    checks: Dict[str, bool] = field(default_factory=dict)
    failure_reasons: List[str] = field(default_factory=list)
    approved_text: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "approved_output": self.approved_output,
            "echo_status": self.echo_status,
            "checks": dict(sorted(self.checks.items())),
            "failure_reasons": list(self.failure_reasons),
            "approved_text": self.approved_text,
        }

    def echo_hash(self) -> str:
        return canonical_hash({k: v for k, v in self.to_dict().items() if k != "approved_text"})


def validate_and_approve(meaning: MeaningManifest, rendered_text: str) -> EchoResult:
    checks: Dict[str, bool] = {}
    reasons: List[str] = []

    text = rendered_text or ""
    low = text.lower()

    # 1) The exact answer value must appear in the spoken text.
    answer_present = meaning.answer_text in text
    checks["answer_value_present"] = answer_present
    if not answer_present:
        reasons.append("answer_value_missing_from_rendering")

    # 2) The unit (if any) must appear.
    if meaning.answer_unit:
        unit_present = meaning.answer_unit.lower() in low
        checks["answer_unit_present"] = unit_present
        if not unit_present:
            reasons.append("answer_unit_missing_from_rendering")

    # 3) Verification language must be preserved.
    verification_present = ("verif" in low) or ("check" in low)
    checks["verification_preserved"] = verification_present
    if not verification_present:
        reasons.append("verification_not_preserved")

    # 4) No empirical overclaim attached to a closed arithmetic answer.
    no_overclaim = not any(term in low for term in _OVERCLAIM_TERMS)
    checks["no_empirical_overclaim"] = no_overclaim
    if not no_overclaim:
        reasons.append("empirical_overclaim_detected")

    # 5) Claim status must be a resolved manifest to be delivered as an answer.
    resolved = meaning.claim_status == ClaimStatus.RESOLVED_MANIFEST.value
    checks["claim_status_resolved"] = resolved
    if not resolved:
        reasons.append("claim_status_not_resolved")

    approved = not reasons
    return EchoResult(
        approved_output=approved,
        echo_status=(
            "ECHO_APPROVED_RENDERING_WITHIN_MANIFEST_SCOPE" if approved else "ECHO_REJECTED_RENDERING"
        ),
        checks=checks,
        failure_reasons=reasons,
        approved_text=text if approved else "",
    )


def validate_and_approve_v2(
    meaning: MeaningManifest,
    rendered_text: str,
    manifest_contract_v2: object,
) -> EchoResult:
    """Echo approval path that requires the GP-008 render-authority envelope."""
    from .manifest_contract_v2 import ManifestContractV2BoundaryError, require_render_authority

    try:
        require_render_authority(manifest_contract_v2, meaning)
    except ManifestContractV2BoundaryError as exc:
        return EchoResult(
            approved_output=False,
            echo_status="ECHO_REJECTED_RENDERING",
            checks={"manifest_contract_v2_valid": False},
            failure_reasons=[f"manifest_contract_v2_invalid: {exc}"],
            approved_text="",
        )

    base = validate_and_approve(meaning, rendered_text)
    checks = dict(base.checks)
    checks.update({
        "manifest_contract_v2_valid": True,
        "meaning_hash_bound_to_contract": True,
        "render_permission_declared": True,
        "echo_required_by_contract": True,
    })
    return EchoResult(
        approved_output=base.approved_output,
        # Preserve the sealed GP-001 public Echo status string for backward
        # compatibility; GP-008 authority is carried by the added checks and
        # the separate delivery-authorization receipt.
        echo_status=base.echo_status,
        checks=checks,
        failure_reasons=list(base.failure_reasons),
        approved_text=base.approved_text,
    )


__all__ = ["EchoResult", "validate_and_approve", "validate_and_approve_v2"]
