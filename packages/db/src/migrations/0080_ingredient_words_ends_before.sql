-- The ingredient words' `servedWith` list is `endsBefore`: the words a name ends before, a note's
-- "for" too. An administrator's edited words keep theirs under the new name.
UPDATE "server_config"
SET "value" = jsonb_set("value", '{words}', (
  SELECT jsonb_object_agg(
    "locale",
    CASE WHEN "words" ? 'servedWith'
      THEN ("words" - 'servedWith') || jsonb_build_object('endsBefore', "words" -> 'servedWith')
      ELSE "words"
    END
  )
  FROM jsonb_each("value" -> 'words') AS "languages"("locale", "words")
))
WHERE "key" = 'ingredient_words'
  AND jsonb_typeof("value" -> 'words') = 'object'
  AND "value" -> 'words' <> '{}'::jsonb;
