#!/usr/bin/env python3
"""
导出 FastAPI OpenAPI Schema 作为唯一真相源。

用法:
    cd /Users/zhihu/hackathon/cognitive-space-api
    MOCK_LLM=true python3 scripts/export-schema.py

输出:
    openapi.json  — 后端 API 唯一真相源（供前端类型生成）
"""

import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app


def export():
    schema = app.openapi()
    output = Path(__file__).parent.parent / "openapi.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
    print(f"✅ OpenAPI schema exported: {output}")
    print(f"   Paths: {len(schema.get('paths', {}))}")
    print(f"   Schemas: {len(schema.get('components', {}).get('schemas', {}))}")


if __name__ == "__main__":
    export()
