from __future__ import annotations

import http.client
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game_guide_studio.registry import SiteRegistry  # noqa: E402
from studio import StudioHandler, origin_is_allowed  # noqa: E402


class OriginTests(unittest.TestCase):
    def test_known_hosted_and_loopback_origins_are_allowed(self) -> None:
        self.assertTrue(origin_is_allowed("https://www.wuziqigo.com"))
        self.assertTrue(origin_is_allowed("https://www.wuziqigo.com"))
        self.assertTrue(origin_is_allowed("http://127.0.0.1:3000"))

    def test_unknown_origin_is_rejected(self) -> None:
        self.assertFalse(origin_is_allowed("https://example.com"))


class CorsHandlerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        StudioHandler.registry = SiteRegistry(ROOT / "sites.json")
        StudioHandler.default_site = StudioHandler.registry.default_site
        StudioHandler.runtimes = {}
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), StudioHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, method: str, origin: str, headers: dict[str, str] | None = None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        request_headers = {"Origin": origin, **(headers or {})}
        connection.request(method, "/studio/", headers=request_headers)
        response = connection.getresponse()
        body = response.read()
        connection.close()
        return response, body

    def test_private_network_preflight(self) -> None:
        response, _ = self.request(
            "OPTIONS",
            "https://www.wuziqigo.com",
            {
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Private-Network": "true",
            },
        )
        self.assertEqual(response.status, 204)
        self.assertEqual(response.getheader("Access-Control-Allow-Origin"), "https://www.wuziqigo.com")
        self.assertEqual(response.getheader("Access-Control-Allow-Private-Network"), "true")

    def test_unknown_cross_origin_request_is_forbidden(self) -> None:
        response, body = self.request("GET", "https://example.com")
        self.assertEqual(response.status, 403)
        self.assertIn("不允许的工作台来源".encode("utf-8"), body)


if __name__ == "__main__":
    unittest.main()
