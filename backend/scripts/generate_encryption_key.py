#!/usr/bin/env python3
"""
Generate a new encryption key for Clinic-AI.

This script generates a secure Fernet encryption key that can be used
for encrypting patient IDs and other sensitive data.
"""

from cryptography.fernet import Fernet
import base64

def generate_encryption_key():
    """Generate a new Fernet encryption key."""
    key = Fernet.generate_key()
    return key.decode('utf-8')

def main():
    print("🔐 Clinic-AI Encryption Key Generator")
    print("=" * 40)
    
    # Generate the key
    encryption_key = generate_encryption_key()
    
    print(f"\n✅ Generated encryption key:")
    print(f"ENCRYPTION_KEY={encryption_key}")
    
    print(f"\n📋 To use this key:")
    print(f"1. Add to your .env file:")
    print(f"   ENCRYPTION_KEY={encryption_key}")
    
    print(f"\n2. Add to render.yaml:")
    print(f"   - key: ENCRYPTION_KEY")
    print(f"     value: {encryption_key}")
    
    print(f"\n3. Add to start_server.bat:")
    print(f"   set ENCRYPTION_KEY={encryption_key}")
    
    print(f"\n⚠️  Important:")
    print(f"- Keep this key secure and don't commit it to version control")
    print(f"- Use the same key in all environments (dev, staging, production)")
    print(f"- If you change the key, existing encrypted data will become unreadable")
    
    # Test the key
    print(f"\n🧪 Testing the key...")
    try:
        fernet = Fernet(encryption_key.encode())
        test_data = "test_patient_id_123"
        encrypted = fernet.encrypt(test_data.encode())
        decrypted = fernet.decrypt(encrypted).decode()
        
        if decrypted == test_data:
            print("✅ Key test successful - encryption/decryption works correctly")
        else:
            print("❌ Key test failed - encryption/decryption mismatch")
    except Exception as e:
        print(f"❌ Key test failed with error: {e}")

if __name__ == "__main__":
    main()
