"""Serve the game with caching disabled, so a reload always picks up your latest edits.

Usage: python tools/serve.py [port]   (default 8123)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent / "game"


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(NoCacheHandler, directory=str(GAME)))
    print(f"Simplicity running at http://localhost:{port}")
    server.serve_forever()
