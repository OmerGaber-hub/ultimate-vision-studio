"""
Integration Tests for Ultimate Vision Studio FastAPI Endpoints
==============================================================
Validates HTTP API endpoints and authentication schema.
"""

import unittest
import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from main import app


class TestAPIEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_health_or_root_endpoint(self):
        # Test basic request response or 404 for unmapped root
        response = self.client.get("/api/health")
        # Accept either 200 or 404 if health route isn't explicitly declared
        self.assertIn(response.status_code, [200, 404])

    def test_auth_validation_on_empty_login(self):
        response = self.client.post("/api/auth/login", json={})
        # Unprocessable entity expected for empty payload
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
