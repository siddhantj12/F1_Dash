import json
from typing import Any
import logging

import redis

from src.config import settings

logger = logging.getLogger(__name__)


class RedisCache:
    def __init__(self, host="localhost", port=6379, db=0):
        self.redis = redis.Redis(host=host, port=port, db=db)
        self.ttl = 3600  # 1 hour default TTL
        self.redis_available = self._check_redis_connection()

    def _check_redis_connection(self) -> bool:
        """Check if Redis is available and accessible"""
        try:
            self.redis.ping()
            return True
        except (redis.ConnectionError, redis.RedisError) as e:
            logger.warning(f"Redis not available: {e}. Running without cache.")
            return False

    async def get(self, key: str) -> Any:
        if not self.redis_available:
            return None
        
        try:
            value = self.redis.get(key)
            if value:
                return json.loads(value)
        except (redis.ConnectionError, redis.RedisError) as e:
            logger.warning(f"Redis get failed: {e}")
            self.redis_available = False
        return None

    async def set(self, key: str, value: Any, ttl: int = None):
        if not self.redis_available or value is None:
            return
        
        try:
            self.redis.set(key, json.dumps(value), ex=ttl or self.ttl)
        except (redis.ConnectionError, redis.RedisError) as e:
            logger.warning(f"Redis set failed: {e}")
            self.redis_available = False

    async def delete(self, key: str):
        if not self.redis_available:
            return
        
        try:
            self.redis.delete(key)
        except (redis.ConnectionError, redis.RedisError) as e:
            logger.warning(f"Redis delete failed: {e}")
            self.redis_available = False

# Instantiate the cache object using settings
cache = RedisCache(
    host=settings.redis_host,
    port=settings.redis_port,
    db=settings.redis_db
)
