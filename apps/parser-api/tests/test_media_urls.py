from __future__ import annotations

import unittest

from app.main import _extract_embedded_videos, _extract_image_candidates


class ParserMediaUrlTests(unittest.TestCase):
    def test_extract_image_candidates_resolves_relative_urls(self) -> None:
        html = """
        <html>
          <head>
            <meta property="og:image" content="/images/hero.jpg" />
          </head>
          <body></body>
        </html>
        """

        recipe = {
            "image": [
                "/recipes/the-best-short-ribs-ever-recipe",
                "https://cdn.example.com/recipe.jpg",
            ]
        }

        images = _extract_image_candidates(
            html,
            recipe,
            "https://www.joshuaweissman.com/recipes/the-best-short-ribs-ever-recipe",
        )

        self.assertEqual(
            images,
            [
                "https://www.joshuaweissman.com/recipes/the-best-short-ribs-ever-recipe",
                "https://cdn.example.com/recipe.jpg",
                "https://www.joshuaweissman.com/images/hero.jpg",
            ],
        )

    def test_extract_embedded_videos_resolves_relative_urls(self) -> None:
        html = """
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                "contentUrl": "/videos/demo.mp4",
                "url": "/watch/demo",
                "thumbnailUrl": ["/thumbs/demo.jpg", "https://cdn.example.com/demo.jpg"],
                "name": "Demo video"
              }
            </script>
          </head>
          <body></body>
        </html>
        """

        videos = _extract_embedded_videos(
            html,
            "https://www.example.com/recipes/demo",
        )

        self.assertEqual(len(videos), 1)
        self.assertEqual(str(videos[0].contentUrl), "https://www.example.com/videos/demo.mp4")
        self.assertEqual(str(videos[0].url), "https://www.example.com/watch/demo")
        self.assertEqual(
            [str(value) for value in videos[0].thumbnailUrl],
            [
                "https://www.example.com/thumbs/demo.jpg",
                "https://cdn.example.com/demo.jpg",
            ],
        )


if __name__ == "__main__":
    unittest.main()
