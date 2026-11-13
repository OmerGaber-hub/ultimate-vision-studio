"""
Test Suite for Ultimate Vision Studio - Computer Vision Pipeline
================================================================
Verifies that spatial filtering, tone adjustments, and point operations
produce expected NumPy output shapes and types without memory or buffer issues.
"""

import unittest
import numpy as np
import sys
import os

# Append backend directory to module search path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from vision.spatial import process_spatial_filter
from vision.tone import process_tone_adjustments
from vision.point import process_point_operation


class TestVisionPipeline(unittest.TestCase):

    def setUp(self):
        # Create a synthetic 100x100 BGR test image
        self.sample_bgr = np.zeros((100, 100, 3), dtype=np.uint8)
        self.sample_bgr[25:75, 25:75] = [255, 128, 64]

    def test_spatial_gaussian_blur(self):
        config = {
            "type": "blur",
            "kernel_size": 5,
            "sigma": 1.5
        }
        result = process_spatial_filter(self.sample_bgr, config)
        self.assertEqual(result.shape, self.sample_bgr.shape)
        self.assertEqual(result.dtype, np.uint8)

    def test_tone_adjustments(self):
        config = {
            "brightness": 20,
            "contrast": 1.2,
            "gamma": 1.0,
            "saturation": 1.1
        }
        result = process_tone_adjustments(self.sample_bgr, config)
        self.assertEqual(result.shape, self.sample_bgr.shape)
        self.assertEqual(result.dtype, np.uint8)

    def test_point_operations_invert(self):
        config = {
            "operation": "invert"
        }
        result = process_point_operation(self.sample_bgr, config)
        self.assertEqual(result.shape, self.sample_bgr.shape)
        # Background was 0, inverted should be 255
        self.assertEqual(result[0, 0, 0], 255)


if __name__ == "__main__":
    unittest.main()
