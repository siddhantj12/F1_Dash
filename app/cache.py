import redis
import json
from typing import Any

class RedisCache:
    def __init__(self, host='localhost', port=6379, db=0):
        self.redis = redis.Redis(host=host, port=port, db=db)
        self.ttl = 3600  # 1 hour default TTL

    async def get(self, key: str) -> Any:
        value = self.redis.get(key)
        if value:
            return json.loads(value)
        return None

    async def set(self, key: str, value: Any, ttl: int = None):
        if value is not None:  # Add this check
            self.redis.set(key, json.dumps(value), ex=ttl or self.ttl)

    async def delete(self, key: str):
        self.redis.delete(key)