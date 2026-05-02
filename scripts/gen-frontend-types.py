#!/usr/bin/env python3
"""
从 openapi.json 生成前端 TypeScript 类型定义。

用法:
    python3 scripts/gen-frontend-types.py

输出:
    frontend/src/api-types.ts
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

SCHEMA_PATH = Path(__file__).parent.parent / "openapi.json"
OUTPUT_PATH = Path(__file__).parent.parent / "frontend" / "src" / "api-types.ts"

# OpenAPI type -> TypeScript type
TYPE_MAP = {
    "string": "string",
    "integer": "number",
    "number": "number",
    "boolean": "boolean",
    "array": "Array<unknown>",
    "object": "Record<string, unknown>",
}


def to_camel(name: str) -> str:
    """snake_case -> CamelCase"""
    return "".join(w.capitalize() for w in name.split("_"))


def resolve_ref(ref: str, schemas: dict) -> dict:
    """Resolve $ref to actual schema."""
    name = ref.split("/")[-1]
    return schemas.get(name, {})


def ts_type(schema: dict, schemas: dict, required: bool = True) -> str:
    """Convert OpenAPI schema to TypeScript type string."""
    if not schema:
        return "unknown"

    if "$ref" in schema:
        ref_schema = resolve_ref(schema["$ref"], schemas)
        return to_camel(schema["$ref"].split("/")[-1])

    if "anyOf" in schema:
        types = [ts_type(s, schemas, required) for s in schema["anyOf"]]
        return " | ".join(t for t in types if t)

    schema_type = schema.get("type", "")

    if schema_type == "array":
        item_type = ts_type(schema.get("items", {}), schemas)
        return f"Array<{item_type}>"

    if schema_type == "object":
        props = schema.get("properties", {})
        if not props:
            return "Record<string, unknown>"
        lines = ["{"]
        req = schema.get("required", [])
        for key, prop in props.items():
            optional = "" if key in req else "?"
            pt = ts_type(prop, schemas)
            lines.append(f"    {key}{optional}: {pt};")
        lines.append("  }")
        return "\n".join(lines)

    if "enum" in schema:
        return " | ".join(json.dumps(v) for v in schema["enum"])

    return TYPE_MAP.get(schema_type, "unknown")


def gen_interface(name: str, schema: dict, schemas: dict) -> str:
    """Generate TypeScript interface or type from schema."""
    ts = ts_type(schema, schemas)
    if " | " in ts and "{" not in ts:
        # Enum-like type
        return f"export type {to_camel(name)} = {ts};"
    lines = [f"export interface {to_camel(name)} {ts}"]
    return "\n".join(lines)


def main():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        spec = json.load(f)

    schemas = spec.get("components", {}).get("schemas", {})

    # Skip FastAPI internal schemas
    SKIP = {"HTTPValidationError", "ValidationError"}
    user_schemas = {k: v for k, v in schemas.items() if k not in SKIP}

    lines = [
        "// Auto-generated from openapi.json — DO NOT EDIT MANUALLY",
        "// Run: python3 scripts/gen-frontend-types.py",
        "",
    ]

    for name in sorted(user_schemas.keys()):
        schema = user_schemas[name]
        lines.append(gen_interface(name, schema, schemas))
        lines.append("")

    # Generate API endpoint types
    lines.append("export interface ApiEndpoints {")
    paths = spec.get("paths", {})
    for path, methods in sorted(paths.items()):
        for method, detail in methods.items():
            op_id = detail.get("operationId", f"{method}_{path}")
            lines.append(f"  '{op_id}': {{ method: '{method.upper()}'; path: '{path}' }};")
    lines.append("}")
    lines.append("")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"✅ Frontend types generated: {OUTPUT_PATH}")
    print(f"   Schemas: {len(user_schemas)}")
    print(f"   Endpoints: {sum(len(m) for m in paths.values())}")


if __name__ == "__main__":
    main()
