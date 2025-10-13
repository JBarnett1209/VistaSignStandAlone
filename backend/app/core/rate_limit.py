"""
Centralized rate limiting utilities using SlowAPI.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded


# Export a singleton limiter for use across the app
limiter = Limiter(key_func=get_remote_address)

__all__ = ["limiter", "RateLimitExceeded"]


