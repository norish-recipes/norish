from __future__ import annotations

import json
import unittest

from app.main import ParseRequest, parse_recipe


def _page(recipe: dict) -> str:
    recipe = {"@context": "https://schema.org", "@type": "Recipe", **recipe}

    return (
        '<html><head><script type="application/ld+json">'
        f"{json.dumps(recipe)}"
        "</script></head><body><h1>Kartoffelsalat</h1></body></html>"
    )


def _parse(recipe: dict) -> dict:
    response = parse_recipe(
        ParseRequest(url="https://www.lecker.de/kartoffelsalat-12345.html", html=_page(recipe))
    )

    assert response.ok, response
    return response.recipe


class ParserInstructionsTests(unittest.TestCase):
    def test_reads_schema_steps_a_site_scraper_missed(self) -> None:
        # The Lecker scraper reads steps from markup this page does not have.
        recipe = _parse(
            {
                "name": "Kartoffelsalat",
                "recipeIngredient": ["1 kg Kartoffeln", "1 Zwiebel"],
                "recipeInstructions": [
                    {"@type": "HowToStep", "text": "Kartoffeln kochen."},
                    {"@type": "HowToStep", "text": "Zwiebel würfeln."},
                ],
            }
        )

        self.assertEqual(recipe["instructions_list"], ["Kartoffeln kochen.", "Zwiebel würfeln."])

    def test_a_recipe_without_steps_still_parses(self) -> None:
        recipe = _parse({"name": "Kartoffelsalat", "recipeIngredient": ["1 kg Kartoffeln"]})

        self.assertEqual(recipe["title"], "Kartoffelsalat")
        self.assertFalse(recipe.get("instructions_list"))


    def test_hands_over_steps_in_sections_as_they_are(self) -> None:
        # recipe-scrapers would make "Für den Salat" a step of its own.
        steps = [
            {
                "@type": "HowToSection",
                "name": "Für den Salat",
                "itemListElement": [{"@type": "HowToStep", "text": "Kartoffeln kochen."}],
            },
            {
                "@type": "HowToSection",
                "name": "Für das Dressing",
                "itemListElement": [{"@type": "HowToStep", "text": "Zwiebel würfeln."}],
            },
        ]
        recipe = _parse(
            {
                "name": "Kartoffelsalat",
                "recipeIngredient": ["1 kg Kartoffeln"],
                "recipeInstructions": steps,
            }
        )

        self.assertEqual(recipe["recipeInstructions"], steps)

    def test_steps_without_sections_stay_the_scrapers(self) -> None:
        recipe = _parse(
            {
                "name": "Kartoffelsalat",
                "recipeIngredient": ["1 kg Kartoffeln"],
                "recipeInstructions": [{"@type": "HowToStep", "text": "Kartoffeln kochen."}],
            }
        )

        self.assertIsNone(recipe.get("recipeInstructions"))

if __name__ == "__main__":
    unittest.main()
