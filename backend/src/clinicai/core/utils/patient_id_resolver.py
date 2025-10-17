"""
Patient ID resolution utilities.

This module provides utilities for safely resolving patient IDs that may be
either encrypted tokens or plain text IDs.
"""

import logging
from typing import Optional
from urllib.parse import unquote

from .crypto import decode_patient_id

logger = logging.getLogger(__name__)


def resolve_patient_id(patient_id: str, context: str = "unknown") -> str:
    """
    Safely resolve a patient ID that may be encrypted or plain text.
    
    Args:
        patient_id: The patient ID to resolve (may be encrypted or plain text)
        context: Context for logging (e.g., "SOAP endpoint", "intake form")
    
    Returns:
        The resolved internal patient ID
        
    Raises:
        ValueError: If the patient ID is invalid
    """
    if not patient_id or not patient_id.strip():
        raise ValueError("Patient ID cannot be empty")
    
    # URL decode the patient ID
    decoded_id = unquote(patient_id.strip())
    
    # Try to decode as encrypted token first
    try:
        internal_id = decode_patient_id(decoded_id)
        logger.debug(f"[{context}] Successfully decoded encrypted patient_id: {decoded_id[:20]}... -> {internal_id}")
        return internal_id
    except Exception as e:
        # If decryption fails, assume it's a plain text patient ID
        logger.debug(f"[{context}] Patient ID appears to be plain text, using as-is: {decoded_id} (decrypt error: {e})")
        
        # Validate that it looks like a reasonable patient ID
        if _is_valid_plain_text_patient_id(decoded_id):
            return decoded_id
        else:
            raise ValueError(f"Invalid patient ID format: {decoded_id}")


def _is_valid_plain_text_patient_id(patient_id: str) -> bool:
    """
    Check if a string looks like a valid plain text patient ID.
    
    Args:
        patient_id: The patient ID to validate
        
    Returns:
        True if it looks like a valid patient ID
    """
    if not patient_id:
        return False
    
    # Basic validation - patient IDs should be reasonable length and contain alphanumeric chars
    if len(patient_id) < 3 or len(patient_id) > 100:
        return False
    
    # Should contain at least some alphanumeric characters
    if not any(c.isalnum() for c in patient_id):
        return False
    
    # Should not contain obviously invalid characters
    invalid_chars = ['<', '>', '"', "'", '&', ';', '(', ')', '{', '}', '[', ']']
    if any(char in patient_id for char in invalid_chars):
        return False
    
    return True


def is_encrypted_patient_id(patient_id: str) -> bool:
    """
    Check if a patient ID appears to be encrypted.
    
    Args:
        patient_id: The patient ID to check
        
    Returns:
        True if it appears to be encrypted
    """
    if not patient_id:
        return False
    
    # Encrypted tokens are typically much longer
    if len(patient_id) < 50:
        return False
    
    # Should be valid base64
    try:
        import base64
        base64.b64decode(patient_id, validate=True)
        
        # Fernet tokens have dots
        if patient_id.count('.') >= 2:
            return True
            
        return False
    except Exception:
        return False
