# HTML Processing

## MODIFIED Requirements

### Requirement: stripHtmlTags MUST process HTML in the correct order to prevent whitespace issues

The `stripHtmlTags` function MUST process HTML in this order: (1) remove HTML tags, (2) decode HTML entities, (3) normalize whitespace, (4) trim. This processing order MUST prevent incorrect whitespace from entity decoding.

**Rationale:** Decoding entities before removing tags causes incorrect whitespace handling

**Priority:** P3 - Text quality

#### Scenario: HTML entities and tags are processed in correct order

**Given** HTML text with mixed entities and tags: `<p>&ldquo;Hello&nbsp;<b>World</b>&rdquo;</p>`  
**When** `stripHtmlTags()` is called  
**Then** it must first remove HTML tags: `&ldquo;Hello&nbsp;World&rdquo;`  
**And** then decode HTML entities: `"Hello World"`  
**And** then normalize whitespace to single spaces  
**And** finally trim leading/trailing whitespace  
**And** the result must be: `"Hello World"` (no trailing space)

#### Scenario: Non-breaking spaces are normalized correctly

**Given** HTML with `&nbsp;` entities  
**When** tags are removed before entity decoding  
**Then** `&nbsp;` must be decoded to a regular space  
**And** multiple consecutive spaces must be collapsed to one space  
**And** no extra trailing spaces should remain

#### Scenario: Smart quotes are preserved during processing

**Given** HTML with `&ldquo;` and `&rdquo;` entities  
**When** `stripHtmlTags()` is called  
**Then** entities must be decoded to Unicode smart quotes (U+201C, U+201D)  
**And** smart quotes must not be converted to straight quotes  
**And** final text must contain proper typographic quotes

#### Scenario: Whitespace normalization happens after entity decoding

**Given** HTML with newlines, tabs, and multiple spaces  
**When** `stripHtmlTags()` processes the text  
**Then** whitespace normalization must occur after entity decoding  
**And** all newlines/tabs must become single spaces  
**And** multiple consecutive spaces must become one space  
**And** leading and trailing whitespace must be removed
