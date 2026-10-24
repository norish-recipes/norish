from __future__ import annotations

import os
import subprocess
import sys
import time
import unittest
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent


def start_parser(parent_pid: int) -> subprocess.Popen[bytes]:
    """The app imported in a session of its own, as Norish starts it, watching `parent_pid`."""
    return subprocess.Popen(
        [sys.executable, "-c", "import app.main, time; time.sleep(30)"],
        cwd=APP_DIR,
        env={**os.environ, "PARSER_API_PARENT_PID": str(parent_pid)},
        start_new_session=True,
    )


class ParentWatchTests(unittest.TestCase):
    def test_stops_once_the_server_that_started_it_is_gone(self) -> None:
        gone = subprocess.Popen([sys.executable, "-c", "pass"])
        gone.wait()
        parser = start_parser(gone.pid)

        try:
            self.assertIsNotNone(parser.wait(timeout=10))
        finally:
            parser.kill()

    def test_keeps_running_while_the_server_lives(self) -> None:
        parser = start_parser(os.getpid())

        try:
            time.sleep(4)
            self.assertIsNone(parser.poll())
        finally:
            parser.kill()
            parser.wait()


if __name__ == "__main__":
    unittest.main()
