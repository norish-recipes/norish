// Hermes has no Intl.ListFormat, and without it react-intl's formatList throws.
// One import per language in the locale catalog; list-format.test.ts catches a missing one.
import "@formatjs/intl-listformat/polyfill-force.js";
import "@formatjs/intl-listformat/locale-data/ar.js";
import "@formatjs/intl-listformat/locale-data/bg.js";
import "@formatjs/intl-listformat/locale-data/da.js";
import "@formatjs/intl-listformat/locale-data/de.js";
import "@formatjs/intl-listformat/locale-data/en.js";
import "@formatjs/intl-listformat/locale-data/es.js";
import "@formatjs/intl-listformat/locale-data/fi.js";
import "@formatjs/intl-listformat/locale-data/fr.js";
import "@formatjs/intl-listformat/locale-data/it.js";
import "@formatjs/intl-listformat/locale-data/ko.js";
import "@formatjs/intl-listformat/locale-data/nl.js";
import "@formatjs/intl-listformat/locale-data/no.js";
import "@formatjs/intl-listformat/locale-data/pl.js";
import "@formatjs/intl-listformat/locale-data/pt.js";
import "@formatjs/intl-listformat/locale-data/ru.js";
import "@formatjs/intl-listformat/locale-data/sv.js";
import "@formatjs/intl-listformat/locale-data/uk.js";
