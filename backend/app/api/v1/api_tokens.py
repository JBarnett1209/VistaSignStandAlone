"""
API Token Management Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.core.api_tokens import ApiTokenService
from app.models.api_token import ApiToken
from app.core.logging_service import get_logger

router = APIRouter()
logger = get_logger(__name__)

class CreateTokenRequest(BaseModel):
    """Request model for creating API token"""
    name: str
    scopes: List[str] = ["read"]
    expires_days: Optional[int] = None

class TokenResponse(BaseModel):
    """Response model for API token"""
    id: str
    name: str
    token_prefix: str
    scopes: str
    is_active: bool
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class CreateTokenResponse(BaseModel):
    """Response model for token creation"""
    token: str  # Only returned once during creation
    token_info: TokenResponse

@router.post("/", response_model=CreateTokenResponse)
async def create_api_token(
    request: CreateTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new API token"""
    try:
        logger.info(f"Creating API token for user {current_user.get('email')}", extra_data={
            'token_name': request.name,
            'scopes': request.scopes,
            'expires_days': request.expires_days
        })
        
        # Create the token
        token, api_token = await ApiTokenService.create_token(
            db=db,
            user_id=current_user["user_id"],
            name=request.name,
            scopes=request.scopes,
            expires_days=request.expires_days
        )
        
        # Prepare response
        token_info = TokenResponse(
            id=str(api_token.id),
            name=api_token.name,
            token_prefix=api_token.token_prefix,
            scopes=api_token.scopes,
            is_active=api_token.is_active,
            last_used_at=api_token.last_used_at,
            expires_at=api_token.expires_at,
            created_at=api_token.created_at,
            updated_at=api_token.updated_at
        )
        
        logger.info(f"Successfully created API token: {api_token.token_prefix}", extra_data={
            'user_id': current_user.get('user_id'),
            'token_id': str(api_token.id)
        })
        
        return CreateTokenResponse(
            token=token,  # Only time the full token is returned
            token_info=token_info
        )
        
    except Exception as e:
        logger.error(f"Error creating API token: {str(e)}", extra_data={
            'user_id': current_user.get('user_id'),
            'token_name': request.name
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create API token"
        )

@router.get("/", response_model=List[TokenResponse])
async def list_api_tokens(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all API tokens for the current user"""
    try:
        logger.info(f"Listing API tokens for user {current_user.get('email')}")
        
        tokens = await ApiTokenService.get_user_tokens(db, current_user["user_id"])
        
        token_responses = []
        for token in tokens:
            token_responses.append(TokenResponse(
                id=str(token.id),
                name=token.name,
                token_prefix=token.token_prefix,
                scopes=token.scopes,
                is_active=token.is_active,
                last_used_at=token.last_used_at,
                expires_at=token.expires_at,
                created_at=token.created_at,
                updated_at=token.updated_at
            ))
        
        logger.info(f"Retrieved {len(token_responses)} API tokens for user {current_user.get('email')}")
        return token_responses
        
    except Exception as e:
        logger.error(f"Error listing API tokens: {str(e)}", extra_data={
            'user_id': current_user.get('user_id')
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list API tokens"
        )

@router.delete("/{token_id}")
async def revoke_api_token(
    token_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Revoke an API token"""
    try:
        logger.info(f"Revoking API token {token_id} for user {current_user.get('email')}")
        
        success = await ApiTokenService.revoke_token(db, token_id, current_user["user_id"])
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API token not found"
            )
        
        logger.info(f"Successfully revoked API token {token_id}", extra_data={
            'user_id': current_user.get('user_id')
        })
        
        return {"message": "API token revoked successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking API token: {str(e)}", extra_data={
            'user_id': current_user.get('user_id'),
            'token_id': token_id
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke API token"
        )

@router.get("/scopes")
async def get_available_scopes():
    """Get list of available API token scopes"""
    return {
        "scopes": [
            {
                "name": "read",
                "description": "Read access to user's data and logs"
            },
            {
                "name": "write", 
                "description": "Write access to user's documents and signatures"
            },
            {
                "name": "admin",
                "description": "Full administrative access (admin users only)"
            }
        ]
    }
