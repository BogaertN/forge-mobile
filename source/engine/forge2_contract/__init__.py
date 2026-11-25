"""Forge 2 codec contract, ported from BogaertN/forge2 src/forge2/contracts.

The codec, the canonical bytes, and the identity metadata are the contract.
Importing this package does not authorize a write, a tool, or a delivery.
"""
from .codec import (
    contract_metadata_from_dict,
    contract_metadata_to_dict,
    contract_reference_from_dict,
    declared_effect_from_dict,
)
from .identity import ContractValidationError

__all__ = [
    'ContractValidationError',
    'contract_metadata_from_dict',
    'contract_metadata_to_dict',
    'contract_reference_from_dict',
    'declared_effect_from_dict',
]
