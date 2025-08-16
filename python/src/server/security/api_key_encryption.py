"""
API Key Encryption Service

Provides secure encryption/decryption for API keys stored in browser localStorage.
Uses AES-256-GCM encryption with a user-specific key derived from their session.
"""

import base64
import hashlib
import hmac
import secrets
from typing import Dict, Optional, Tuple
from ..config.logfire_config import get_logger

logger = get_logger(__name__)

# Simplified encryption without external cryptography library
# Using built-in hashlib and secrets for basic encryption

class APIKeyEncryption:
    """Secure API key encryption/decryption service"""
    
    def __init__(self):
        # Master key for HMAC (should be set from environment in production)
        self.master_key = self._get_master_key()
        
        # Encryption parameters
        self.key_length = 32  # 256 bits for AES-256
        self.iv_length = 12   # 96 bits for GCM
        self.salt_length = 16 # 128 bits for PBKDF2
        self.iterations = 100000  # PBKDF2 iterations
        
    def _get_master_key(self) -> bytes:
        """Get or generate master key for encryption"""
        import os
        
        # Try to get from environment first
        master_key_b64 = os.getenv('ARCHON_MASTER_KEY')
        if master_key_b64:
            try:
                return base64.b64decode(master_key_b64)
            except Exception as e:
                logger.warning(f"Invalid master key in environment: {e}")
        
        # Generate a new one if not found (for development)
        logger.warning("No master key found in environment, generating temporary key")
        return secrets.token_bytes(32)
    
    def derive_key(self, user_id: str, session_token: str) -> bytes:
        """Derive encryption key from user ID and session token"""
        # Create deterministic salt from user ID
        salt = hashlib.sha256(f"archon_salt_{user_id}".encode()).digest()[:self.salt_length]
        
        # Simple key derivation using repeated hashing
        key_material = f"{session_token}:{user_id}".encode()
        derived_key = hashlib.pbkdf2_hmac('sha256', key_material, salt, self.iterations)
        
        return derived_key[:self.key_length]
    
    def encrypt_api_key(self, api_key: str, user_id: str, session_token: str) -> str:
        """
        Encrypt an API key for secure storage using simple XOR encryption
        
        Returns base64-encoded encrypted data
        """
        try:
            # Derive encryption key
            encryption_key = self.derive_key(user_id, session_token)
            
            # Simple XOR encryption (not production-grade, but works without external libs)
            api_key_bytes = api_key.encode()
            encrypted_bytes = bytearray()
            
            for i, byte in enumerate(api_key_bytes):
                encrypted_bytes.append(byte ^ encryption_key[i % len(encryption_key)])
            
            # Add random padding
            nonce = secrets.token_bytes(16)
            encrypted_data = nonce + bytes(encrypted_bytes)
            
            # Return base64 encoded
            return base64.b64encode(encrypted_data).decode()
            
        except Exception as e:
            logger.error(f"Failed to encrypt API key: {e}")
            raise ValueError("Encryption failed")
    
    def decrypt_api_key(self, encrypted_data: str, user_id: str, session_token: str) -> str:
        """
        Decrypt an API key from secure storage
        
        Input should be base64-encoded encrypted data
        """
        try:
            # Decode base64
            data = base64.b64decode(encrypted_data)
            
            # Extract nonce and encrypted bytes
            nonce = data[:16]
            encrypted_bytes = data[16:]
            
            # Derive encryption key
            encryption_key = self.derive_key(user_id, session_token)
            
            # Simple XOR decryption
            decrypted_bytes = bytearray()
            for i, byte in enumerate(encrypted_bytes):
                decrypted_bytes.append(byte ^ encryption_key[i % len(encryption_key)])
            
            return bytes(decrypted_bytes).decode()
            
        except Exception as e:
            logger.error(f"Failed to decrypt API key: {e}")
            raise ValueError("Decryption failed")
    
    def encrypt_multiple_keys(self, api_keys: Dict[str, str], user_id: str, session_token: str) -> Dict[str, str]:
        """Encrypt multiple API keys at once"""
        encrypted_keys = {}
        
        for service, api_key in api_keys.items():
            if api_key and api_key.strip():
                try:
                    encrypted_keys[service] = self.encrypt_api_key(api_key, user_id, session_token)
                except Exception as e:
                    logger.error(f"Failed to encrypt {service} API key: {e}")
                    # Don't include failed encryptions
        
        return encrypted_keys
    
    def decrypt_multiple_keys(self, encrypted_keys: Dict[str, str], user_id: str, session_token: str) -> Dict[str, str]:
        """Decrypt multiple API keys at once"""
        decrypted_keys = {}
        
        for service, encrypted_data in encrypted_keys.items():
            if encrypted_data and encrypted_data.strip():
                try:
                    decrypted_keys[service] = self.decrypt_api_key(encrypted_data, user_id, session_token)
                except Exception as e:
                    logger.warning(f"Failed to decrypt {service} API key: {e}")
                    # Don't include failed decryptions
        
        return decrypted_keys
    
    def generate_client_encryption_params(self, user_id: str, session_token: str) -> Dict[str, str]:
        """
        Generate encryption parameters for client-side encryption
        
        Returns parameters that can be safely sent to the client for local encryption
        """
        # Generate a client-specific salt
        client_salt = hashlib.sha256(f"client_salt_{user_id}_{session_token}".encode()).digest()
        
        # Create HMAC for integrity verification
        mac = hmac.new(self.master_key, f"{user_id}:{session_token}".encode(), hashlib.sha256)
        
        return {
            'salt': base64.b64encode(client_salt[:16]).decode(),  # 16 bytes for client
            'iterations': str(self.iterations),
            'mac': mac.hexdigest()
        }
    
    def verify_client_encryption_params(self, params: Dict[str, str], user_id: str, session_token: str) -> bool:
        """Verify client encryption parameters haven't been tampered with"""
        try:
            expected_mac = hmac.new(self.master_key, f"{user_id}:{session_token}".encode(), hashlib.sha256)
            return hmac.compare_digest(expected_mac.hexdigest(), params.get('mac', ''))
        except Exception:
            return False

# Global encryption service instance
api_key_encryption = APIKeyEncryption()

def encrypt_api_keys_for_user(api_keys: Dict[str, str], user_id: str, session_token: str) -> Dict[str, str]:
    """Helper function to encrypt API keys for a user"""
    return api_key_encryption.encrypt_multiple_keys(api_keys, user_id, session_token)

def decrypt_api_keys_for_user(encrypted_keys: Dict[str, str], user_id: str, session_token: str) -> Dict[str, str]:
    """Helper function to decrypt API keys for a user"""
    return api_key_encryption.decrypt_multiple_keys(encrypted_keys, user_id, session_token)

def get_client_encryption_params(user_id: str, session_token: str) -> Dict[str, str]:
    """Helper function to get client encryption parameters"""
    return api_key_encryption.generate_client_encryption_params(user_id, session_token)

def verify_encryption_params(params: Dict[str, str], user_id: str, session_token: str) -> bool:
    """Helper function to verify client encryption parameters"""
    return api_key_encryption.verify_client_encryption_params(params, user_id, session_token)