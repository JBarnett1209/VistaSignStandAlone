"""
Test JWT token validation functionality
"""

import pytest
import jwt
from datetime import datetime, timedelta, timezone

from app.core.security.auth import AuthHandler
from app.core.config import settings


class TestTokenValidation:
    """Test JWT token validation"""
    
    def setup_method(self):
        """Setup test environment"""
        self.auth_handler = AuthHandler()
        self.test_user_id = "test-user-123"
        self.test_email = "test@example.com"
    
    def test_create_access_token(self):
        """Test access token creation"""
        token = self.auth_handler.create_access_token(
            data={"sub": self.test_user_id, "email": self.test_email}
        )
        
        assert token is not None
        assert isinstance(token, str)
        
        # Decode and verify token
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        
        assert payload["sub"] == self.test_user_id
        assert payload["email"] == self.test_email
        assert payload["type"] == "access"
        assert "exp" in payload
    
    def test_create_refresh_token(self):
        """Test refresh token creation"""
        token = self.auth_handler.create_refresh_token(
            data={"sub": self.test_user_id}
        )
        
        assert token is not None
        assert isinstance(token, str)
        
        # Decode and verify token
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        
        assert payload["sub"] == self.test_user_id
        assert payload["type"] == "refresh"
        assert "exp" in payload
    
    def test_token_expiration(self):
        """Test token expiration"""
        # Create token with very short expiration
        token = self.auth_handler.create_access_token(
            data={"sub": self.test_user_id, "email": self.test_email},
            expires_delta=timedelta(seconds=1)
        )
        
        # Token should be valid initially
        payload = self.auth_handler.decode_token(token)
        assert payload["sub"] == self.test_user_id
        
        # Wait for expiration
        import time
        time.sleep(2)
        
        # Token should now be expired
        with pytest.raises(jwt.ExpiredSignatureError):
            self.auth_handler.decode_token(token)
    
    def test_invalid_token(self):
        """Test invalid token handling"""
        # Test with invalid token
        with pytest.raises(jwt.InvalidTokenError):
            self.auth_handler.decode_token("invalid.token.here")
        
        # Test with empty token
        with pytest.raises(jwt.InvalidTokenError):
            self.auth_handler.decode_token("")
        
        # Test with None token
        with pytest.raises(jwt.InvalidTokenError):
            self.auth_handler.decode_token(None)
    
    def test_token_with_wrong_secret(self):
        """Test token with wrong secret key"""
        # Create token with correct secret
        token = self.auth_handler.create_access_token(
            data={"sub": self.test_user_id, "email": self.test_email}
        )
        
        # Try to decode with wrong secret
        with pytest.raises(jwt.InvalidTokenError):
            jwt.decode(token, "wrong-secret", algorithms=[settings.ALGORITHM])
    
    def test_token_type_validation(self):
        """Test token type validation"""
        # Create access token
        access_token = self.auth_handler.create_access_token(
            data={"sub": self.test_user_id, "email": self.test_email}
        )
        
        # Create refresh token
        refresh_token = self.auth_handler.create_refresh_token(
            data={"sub": self.test_user_id}
        )
        
        # Decode tokens
        access_payload = self.auth_handler.decode_token(access_token)
        refresh_payload = self.auth_handler.decode_token(refresh_token)
        
        assert access_payload["type"] == "access"
        assert refresh_payload["type"] == "refresh"
    
    def test_token_with_extra_claims(self):
        """Test token with additional claims"""
        extra_data = {
            "sub": self.test_user_id,
            "email": self.test_email,
            "role": "admin",
            "permissions": ["read", "write"]
        }
        
        token = self.auth_handler.create_access_token(data=extra_data)
        payload = self.auth_handler.decode_token(token)
        
        assert payload["sub"] == self.test_user_id
        assert payload["email"] == self.test_email
        assert payload["role"] == "admin"
        assert payload["permissions"] == ["read", "write"]
    
    def test_token_algorithm_validation(self):
        """Test token algorithm validation"""
        # Create token with correct algorithm
        token = self.auth_handler.create_access_token(
            data={"sub": self.test_user_id, "email": self.test_email}
        )
        
        # Try to decode with wrong algorithm
        with pytest.raises(jwt.InvalidTokenError):
            jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    
    def test_token_issuer_validation(self):
        """Test token issuer validation"""
        # Create token with issuer
        token = self.auth_handler.create_access_token(
            data={"sub": self.test_user_id, "email": self.test_email, "iss": "vistasign"}
        )
        
        payload = self.auth_handler.decode_token(token)
        assert payload["iss"] == "vistasign"
    
    def test_token_audience_validation(self):
        """Test token audience validation"""
        # Create token with audience
        token = self.auth_handler.create_access_token(
            data={"sub": self.test_user_id, "email": self.test_email, "aud": "vistasign-api"}
        )
        
        payload = self.auth_handler.decode_token(token)
        assert payload["aud"] == "vistasign-api"
