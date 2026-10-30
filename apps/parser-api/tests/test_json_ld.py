from __future__ import annotations

import json
import time
import unittest

from app.main import SCRIPT, ParseRequest, _drop_empty_json_ld, parse_recipe


class ParserJsonLdTests(unittest.TestCase):
    def test_reads_the_recipe_beside_an_empty_json_ld_tag(self) -> None:
        # Food Network UK ships empty JSON-LD tags next to its Recipe.
        recipe = {"@context": "https://schema.org", "@type": "Recipe", "name": "Perfect Roast Chicken"}
        html = (
            '<html><head><script type="application/ld+json"></script>'
            f'<script type="application/ld+json">{json.dumps(recipe)}</script>'
            "</head><body></body></html>"
        )

        response = parse_recipe(
            ParseRequest(url="https://foodnetwork.co.uk/recipes/perfect-roast-chicken", html=html)
        )

        assert response.ok, response
        self.assertEqual(response.recipe["title"], "Perfect Roast Chicken")

    def test_drops_an_empty_tag_whatever_its_end_tag_holds(self) -> None:
        html = '<script type="application/ld+json"></SCRIPT >'

        self.assertEqual(SCRIPT.sub(_drop_empty_json_ld, html), "")

    def test_empty_tag_search_stays_linear_on_unclosed_tags(self) -> None:
        # Each takes half a minute under the old [^>]* pattern.
        for html in ("<script" * 50_000, "<script " + "application/ld+json" * 50_000):
            started = time.monotonic()
            self.assertEqual(SCRIPT.sub(_drop_empty_json_ld, html), html)
            self.assertLess(time.monotonic() - started, 1)


if __name__ == "__main__":
    unittest.main()
