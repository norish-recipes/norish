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


def _sectioned_page(sections: list[tuple[str, list[str]]]) -> str:
    """The JSON-LD stays flat and only the markup names the sections, as on Serious Eats (#685)."""
    recipe = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Shepherd's Pie",
        "recipeIngredient": [line for _, lines in sections for line in lines],
    }
    markup = "".join(
        f'<p class="mm-recipes-structured-ingredients__list-heading text-title-200">{heading}</p><ul>'
        + "".join(
            f'<li class="mm-recipes-structured-ingredients__list-item "><p>{line}</p></li>'
            for line in lines
        )
        + "</ul>"
        for heading, lines in sections
    )

    return (
        '<html><head><script type="application/ld+json">'
        f"{json.dumps(recipe)}"
        f"</script></head><body>{markup}</body></html>"
    )


def _parse_serious_eats(html: str) -> dict:
    response = parse_recipe(ParseRequest(url="https://www.seriouseats.com/pie", html=html))

    assert response.ok, response
    return response.recipe


class ParserIngredientSectionsTests(unittest.TestCase):
    def test_reads_sections_from_the_structured_ingredients_markup(self) -> None:
        recipe = _parse_serious_eats(
            _sectioned_page(
                [
                    ("For the Mashed Potatoes:", ["1 kg russet potatoes", "Kosher salt"]),
                    ("For the Meat Sauce:", ["500 g ground lamb", "Kosher salt"]),
                ]
            )
        )

        self.assertEqual(
            recipe["ingredient_groups"],
            [
                {
                    "purpose": "For the Mashed Potatoes:",
                    "ingredients": ["1 kg russet potatoes", "Kosher salt"],
                },
                {
                    "purpose": "For the Meat Sauce:",
                    "ingredients": ["500 g ground lamb", "Kosher salt"],
                },
            ],
        )

    def test_a_page_without_sections_keeps_one_group(self) -> None:
        recipe = _parse_serious_eats(_page({"name": "Pie", "recipeIngredient": ["1 egg"]}))

        self.assertEqual(recipe["ingredient_groups"], [{"purpose": None, "ingredients": ["1 egg"]}])


if __name__ == "__main__":
    unittest.main()
