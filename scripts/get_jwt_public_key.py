#!/usr/bin/env python3
"""
Script to fetch JWT public key from Supabase JWKS endpoint.
Usage: python3 get_jwt_public_key.py <supabase_url>
"""

import sys
import json
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import base64

def get_jwt_public_key(supabase_url: str) -> str:
    """Fetch JWT public key from Supabase JWKS endpoint."""
    jwks_url = f"{supabase_url.rstrip('/')}/.well-known/jwks.json"
    
    try:
        response = requests.get(jwks_url, timeout=10)
        response.raise_for_status()
        jwks = response.json()
        
        # Get the first key (Supabase typically has one)
        if not jwks.get("keys"):
            raise ValueError("No keys found in JWKS")
        
        key_data = jwks["keys"][0]
        
        # Extract modulus and exponent
        n = base64.urlsafe_b64decode(key_data["n"] + "==")
        e = base64.urlsafe_b64decode(key_data["e"] + "==")
        
        # Convert to integers
        n_int = int.from_bytes(n, "big")
        e_int = int.from_bytes(e, "big")
        
        # Reconstruct RSA public key
        public_numbers = rsa.RSAPublicNumbers(e_int, n_int)
        public_key = public_numbers.public_key()
        
        # Serialize to PEM format
        pem = public_key.public_key_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        return pem.decode("utf-8").strip()
        
    except Exception as e:
        print(f"Error fetching JWT public key: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 get_jwt_public_key.py <supabase_url>", file=sys.stderr)
        print("Example: python3 get_jwt_public_key.py https://nvrrqvlqnnvlihtlgmzn.supabase.co", file=sys.stderr)
        sys.exit(1)
    
    supabase_url = sys.argv[1]
    public_key = get_jwt_public_key(supabase_url)
    print(public_key)
