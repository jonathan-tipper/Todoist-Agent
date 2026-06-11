#!/usr/bin/env python3
"""Todoist API v1 helper for the Hermes Todoist skill."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib import error, parse, request


DEFAULT_BASE_URL = "https://api.todoist.com/api/v1"
TOKEN_ENV_NAMES = ("TODOIST_API_TOKEN", "TODOIST_ACCESS_TOKEN")
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class TodoistCliError(RuntimeError):
    pass


@dataclass(frozen=True)
class FilePart:
    field: str
    path: Path
    filename: str
    content_type: str


def token_from_env() -> str:
    for name in TOKEN_ENV_NAMES:
        value = os.environ.get(name)
        if value:
            return value
    joined = ", ".join(TOKEN_ENV_NAMES)
    raise TodoistCliError(f"Missing Todoist token. Set one of: {joined}")


def base_url_from_env() -> str:
    return os.environ.get("TODOIST_API_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def default_limit_from_env() -> int | None:
    value = os.environ.get("TODOIST_DEFAULT_LIMIT")
    if not value:
        return None
    try:
        limit = int(value)
    except ValueError as exc:
        raise TodoistCliError("TODOIST_DEFAULT_LIMIT must be an integer") from exc
    if limit < 1 or limit > 200:
        raise TodoistCliError("TODOIST_DEFAULT_LIMIT must be between 1 and 200")
    return limit


def parse_key_value(items: list[str]) -> list[tuple[str, str]]:
    parsed: list[tuple[str, str]] = []
    for item in items:
        if "=" not in item:
            raise TodoistCliError(f"Expected KEY=VALUE, got: {item}")
        key, value = item.split("=", 1)
        if not key:
            raise TodoistCliError(f"Missing key in KEY=VALUE item: {item}")
        parsed.append((key, value))
    return parsed


def load_json_value(value: str | None) -> Any:
    if value is None:
        return None
    if value.startswith("@"):
        path = Path(value[1:]).expanduser()
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(value)


def encode_multipart(fields: list[tuple[str, str]], files: list[FilePart]) -> tuple[bytes, str]:
    boundary = f"----todoist-hermes-{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    for key, value in fields:
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                str(value).encode(),
                b"\r\n",
            ]
        )

    for file_part in files:
        data = file_part.path.read_bytes()
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                (
                    f'Content-Disposition: form-data; name="{file_part.field}"; '
                    f'filename="{file_part.filename}"\r\n'
                ).encode(),
                f"Content-Type: {file_part.content_type}\r\n\r\n".encode(),
                data,
                b"\r\n",
            ]
        )

    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def parse_file_part(value: str) -> FilePart:
    if "=" not in value:
        raise TodoistCliError("Expected --file FIELD=PATH[:CONTENT_TYPE]")
    field, spec = value.split("=", 1)
    if not field:
        raise TodoistCliError("Missing multipart field name")
    path_part, separator, content_type = spec.partition(":")
    path = Path(path_part).expanduser()
    if not path.is_file():
        raise TodoistCliError(f"File not found: {path}")
    guessed = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FilePart(
        field=field,
        path=path,
        filename=path.name,
        content_type=content_type if separator else guessed,
    )


def build_url(path: str, query: list[tuple[str, str]] | None = None) -> str:
    if path.startswith("https://") or path.startswith("http://"):
        url = path
    else:
        normalized = "/" + path.lstrip("/")
        url = base_url_from_env() + normalized

    if query:
        separator = "&" if parse.urlparse(url).query else "?"
        url = url + separator + parse.urlencode(query)
    return url


def request_headers(token: str, content_type: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "todoist-hermes-skill/1.0",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def decode_response(data: bytes, headers: Any, raw_output: str | None) -> Any:
    if raw_output:
        Path(raw_output).expanduser().write_bytes(data)
        return {"saved_to": raw_output, "bytes": len(data)}

    content_type = headers.get("Content-Type", "") if headers else ""
    if "application/json" in content_type or looks_like_json(data):
        if not data:
            return None
        return json.loads(data.decode("utf-8"))
    return {"text": data.decode("utf-8", errors="replace")}


def looks_like_json(data: bytes) -> bool:
    stripped = data.lstrip()
    return stripped.startswith(b"{") or stripped.startswith(b"[") or stripped in {b"null", b"true", b"false"}


def http_request(
    method: str,
    path: str,
    *,
    token: str,
    query: list[tuple[str, str]] | None = None,
    json_body: Any = None,
    form_body: list[tuple[str, str]] | None = None,
    file_parts: list[FilePart] | None = None,
    raw_output: str | None = None,
) -> Any:
    body: bytes | None = None
    content_type: str | None = None

    if file_parts:
        body, content_type = encode_multipart(form_body or [], file_parts)
    elif json_body is not None:
        body = json.dumps(json_body, separators=(",", ":")).encode("utf-8")
        content_type = "application/json"
    elif form_body:
        body = parse.urlencode(form_body).encode("utf-8")
        content_type = "application/x-www-form-urlencoded"

    url = build_url(path, query)
    req = request.Request(url, data=body, method=method, headers=request_headers(token, content_type))
    try:
        with request.urlopen(req, timeout=60) as response:
            return decode_response(response.read(), response.headers, raw_output)
    except error.HTTPError as exc:
        payload = exc.read()
        try:
            decoded = decode_response(payload, exc.headers, None)
        except Exception:
            decoded = {"text": payload.decode("utf-8", errors="replace")}
        raise TodoistCliError(json.dumps({"status": exc.code, "error": decoded}, indent=2)) from exc
    except error.URLError as exc:
        raise TodoistCliError(f"Request failed: {exc.reason}") from exc


def collect_pages(
    path: str,
    *,
    token: str,
    query: list[tuple[str, str]],
    max_pages: int,
    raw_output: str | None,
) -> Any:
    if raw_output:
        raise TodoistCliError("--raw-output cannot be combined with --all-pages")

    results: list[Any] = []
    cursor: str | None = None
    pages = 0
    base_query = [(k, v) for k, v in query if k != "cursor"]

    while True:
        page_query = list(base_query)
        if cursor:
            page_query.append(("cursor", cursor))
        data = http_request("GET", path, token=token, query=page_query)
        pages += 1
        if not isinstance(data, dict) or "results" not in data:
            raise TodoistCliError("Expected paginated JSON object with a results field")
        page_results = data.get("results")
        if not isinstance(page_results, list):
            raise TodoistCliError("Expected paginated results to be an array")
        results.extend(page_results)
        cursor = data.get("next_cursor")
        if not cursor or pages >= max_pages:
            return {"results": results, "pages": pages, "next_cursor": cursor, "truncated": bool(cursor)}


def ensure_write_allowed(method: str, *, yes: bool, dry_run: bool) -> None:
    if method in MUTATING_METHODS and not yes and not dry_run:
        raise TodoistCliError(f"{method} is mutating. Re-run with --yes after user confirmation, or use --dry-run.")


def command_request(args: argparse.Namespace) -> Any:
    method = args.method.upper()
    ensure_write_allowed(method, yes=args.yes, dry_run=args.dry_run)
    query = parse_key_value(args.query)
    form_body = parse_key_value(args.data)
    file_parts = [parse_file_part(item) for item in args.file]
    json_body = load_json_value(args.json_body)

    default_limit = args.limit if args.limit is not None else default_limit_from_env()
    if method == "GET" and default_limit is not None and not any(key == "limit" for key, _ in query):
        query.append(("limit", str(default_limit)))

    if args.dry_run:
        return {
            "dry_run": True,
            "method": method,
            "url": build_url(args.path, query),
            "has_json_body": json_body is not None,
            "form_fields": [key for key, _ in form_body],
            "files": [{"field": part.field, "filename": part.filename, "content_type": part.content_type} for part in file_parts],
        }

    token = token_from_env()
    if args.all_pages:
        if method != "GET":
            raise TodoistCliError("--all-pages is only supported for GET")
        return collect_pages(args.path, token=token, query=query, max_pages=args.max_pages, raw_output=args.raw_output)
    return http_request(
        method,
        args.path,
        token=token,
        query=query,
        json_body=json_body,
        form_body=form_body,
        file_parts=file_parts,
        raw_output=args.raw_output,
    )


def command_sync(args: argparse.Namespace) -> Any:
    commands = load_json_value(args.commands)
    if commands is not None and not args.yes and not args.dry_run:
        raise TodoistCliError("Sync commands are mutating. Re-run with --yes after user confirmation, or use --dry-run.")
    if commands is not None:
        if not isinstance(commands, list):
            raise TodoistCliError("--commands must be a JSON array")
        if len(commands) > 100:
            raise TodoistCliError("Todoist allows at most 100 sync commands per request")
        for command in commands:
            command.setdefault("uuid", str(uuid.uuid4()))

    fields = []
    if commands is not None:
        fields.append(("commands", json.dumps(commands, separators=(",", ":"))))
    else:
        fields.append(("sync_token", args.sync_token))
        fields.append(("resource_types", args.resource_types))

    if args.dry_run:
        return {"dry_run": True, "endpoint": "/sync", "fields": [key for key, _ in fields], "command_count": len(commands or [])}

    return http_request("POST", "/sync", token=token_from_env(), form_body=fields)


def command_doctor(_: argparse.Namespace) -> Any:
    token = token_from_env()
    data = http_request("GET", "/user", token=token)
    if isinstance(data, dict):
        return {
            "ok": True,
            "user_id": data.get("id"),
            "email_present": bool(data.get("email")),
            "plan_limits_present": "user_plan_limits" in data or "limits" in data,
        }
    return {"ok": True, "response_type": type(data).__name__}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Call Todoist API v1 for the Hermes Todoist skill.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    request_parser = subparsers.add_parser("request", help="Call a Todoist API v1 endpoint.")
    request_parser.add_argument("method", help="HTTP method, e.g. GET, POST, PUT, DELETE")
    request_parser.add_argument("path", help="API path such as /tasks or a full URL")
    request_parser.add_argument("--query", action="append", default=[], metavar="KEY=VALUE")
    request_parser.add_argument("--data", action="append", default=[], metavar="KEY=VALUE", help="Form body field")
    request_parser.add_argument("--json", dest="json_body", help="JSON body string or @file.json")
    request_parser.add_argument("--file", action="append", default=[], metavar="FIELD=PATH[:CONTENT_TYPE]")
    request_parser.add_argument("--limit", type=int, default=None)
    request_parser.add_argument("--all-pages", action="store_true")
    request_parser.add_argument("--max-pages", type=int, default=100)
    request_parser.add_argument("--raw-output", help="Write non-JSON response bytes to a file")
    request_parser.add_argument("--yes", action="store_true", help="Confirm a mutating API request")
    request_parser.add_argument("--dry-run", action="store_true")
    request_parser.set_defaults(func=command_request)

    sync_parser = subparsers.add_parser("sync", help="Call Todoist /sync for reads or batch commands.")
    sync_parser.add_argument("--sync-token", default="*")
    sync_parser.add_argument("--resource-types", default='["all"]', help="JSON array string")
    sync_parser.add_argument("--commands", help="JSON command array or @file.json")
    sync_parser.add_argument("--yes", action="store_true", help="Confirm mutating sync commands")
    sync_parser.add_argument("--dry-run", action="store_true")
    sync_parser.set_defaults(func=command_sync)

    doctor_parser = subparsers.add_parser("doctor", help="Verify token and API reachability.")
    doctor_parser.set_defaults(func=command_doctor)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = args.func(args)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except TodoistCliError as exc:
        print(f"todoist_api.py: {exc}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"todoist_api.py: invalid JSON: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
