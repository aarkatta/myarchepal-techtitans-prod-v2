"""
Shared slowapi rate limiter instance.

Import `limiter` in routers and decorate endpoints with @limiter.limit("N/minute").
The exception handler is registered in index.py.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
