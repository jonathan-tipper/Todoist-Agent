#!/usr/bin/env python3
"""Unit tests for todoist_api.py without touching Todoist."""

from __future__ import annotations

import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import todoist_api


class FakeHeaders(dict):
    def get(self, key: str, default: Any = None) -> Any:
        return super().get(key, default)


class FakeResponse:
    def __init__(self, payload: Any, content_type: str = "application/json") -> None:
        self.payload = json.dumps(payload).encode("utf-8")
        self.headers = FakeHeaders({"Content-Type": content_type})

    def read(self) -> bytes:
        return self.payload

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        return None


class TodoistApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.env_patch = mock.patch.dict(os.environ, {"TODOIST_API_TOKEN": "token"}, clear=False)
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def run_cli(self, argv: list[str]) -> tuple[int, str]:
        output = io.StringIO()
        with redirect_stdout(output):
            code = todoist_api.main(argv)
        return code, output.getvalue()

    def test_get_request_adds_bearer_auth(self) -> None:
        with mock.patch("todoist_api.request.urlopen", return_value=FakeResponse({"ok": True})) as urlopen:
            code, output = self.run_cli(["request", "GET", "/tasks", "--query", "limit=1"])

        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output), {"ok": True})
        req = urlopen.call_args.args[0]
        self.assertEqual(req.headers["Authorization"], "Bearer token")
        self.assertIn("/tasks?limit=1", req.full_url)

    def test_mutating_request_requires_confirmation(self) -> None:
        code, _ = self.run_cli(["request", "POST", "/tasks", "--json", '{"content":"x"}'])
        self.assertEqual(code, 2)

    def test_mutating_request_dry_run_does_not_require_token_or_network(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            with mock.patch("todoist_api.request.urlopen") as urlopen:
                code, output = self.run_cli(["request", "DELETE", "/tasks/abc", "--dry-run"])

        self.assertEqual(code, 0)
        urlopen.assert_not_called()
        payload = json.loads(output)
        self.assertTrue(payload["dry_run"])
        self.assertEqual(payload["method"], "DELETE")

    def test_get_all_pages_aggregates_results(self) -> None:
        responses = [
            FakeResponse({"results": [{"id": "1"}], "next_cursor": "next"}),
            FakeResponse({"results": [{"id": "2"}], "next_cursor": None}),
        ]
        with mock.patch("todoist_api.request.urlopen", side_effect=responses):
            code, output = self.run_cli(["request", "GET", "/tasks", "--all-pages", "--query", "limit=200"])

        self.assertEqual(code, 0)
        payload = json.loads(output)
        self.assertEqual(payload["results"], [{"id": "1"}, {"id": "2"}])
        self.assertEqual(payload["pages"], 2)
        self.assertFalse(payload["truncated"])

    def test_default_limit_env_applies_to_get_requests(self) -> None:
        with mock.patch.dict(os.environ, {"TODOIST_DEFAULT_LIMIT": "25"}, clear=False):
            with mock.patch("todoist_api.request.urlopen", return_value=FakeResponse({"results": [], "next_cursor": None})) as urlopen:
                code, _ = self.run_cli(["request", "GET", "/projects"])

        self.assertEqual(code, 0)
        req = urlopen.call_args.args[0]
        self.assertIn("/projects?limit=25", req.full_url)

    def test_sync_commands_require_confirmation(self) -> None:
        code, _ = self.run_cli(["sync", "--commands", '[{"type":"item_complete","args":{"id":"1"}}]'])
        self.assertEqual(code, 2)

    def test_sync_adds_command_uuid(self) -> None:
        with mock.patch("todoist_api.request.urlopen", return_value=FakeResponse({"sync_status": {}})) as urlopen:
            code, output = self.run_cli(["sync", "--commands", '[{"type":"item_complete","args":{"id":"1"}}]', "--yes"])

        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output), {"sync_status": {}})
        req = urlopen.call_args.args[0]
        body = req.data.decode("utf-8")
        decoded = dict(item.split("=", 1) for item in body.split("&"))
        commands = json.loads(todoist_api.parse.unquote(decoded["commands"]))
        self.assertIn("uuid", commands[0])

    def test_sync_rejects_more_than_100_commands(self) -> None:
        commands = [{"type": "item_complete", "args": {"id": str(index)}} for index in range(101)]
        code, _ = self.run_cli(["sync", "--commands", json.dumps(commands), "--yes"])
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()
