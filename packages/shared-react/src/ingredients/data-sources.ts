/** The links each Data sources notice carries, by the rich-text tag its message wraps them in. */
export const DATA_SOURCE_LINKS = {
  notice: {
    off: "https://world.openfoodfacts.org",
    odbl: "https://opendatacommons.org/licenses/odbl/1-0/",
  },
  nutritionNotice: {
    ciqual: "https://ciqual.anses.fr",
    usda: "https://fdc.nal.usda.gov",
    cofid:
      "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
  },
} as const;

/** Where the signed-in reader downloads the ingredient catalogue as JSON, under the server's address. */
export const CATALOGUE_EXPORT_PATH = "/export/ingredients";
