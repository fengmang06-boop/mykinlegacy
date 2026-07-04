# MyKinLegacy Crest Genome Library V1

## Purpose

The Crest Genome Library is the controlled visual language behind future MyKinLegacy symbolic crests. Its job is not to imitate official heraldry and not to generate random decorative icons. Its job is to assemble dignified, private, symbolic family emblems from a reviewed design library.

This library is review-only in V1. It must not replace paid customer artifacts until Founder visual approval and production integration are explicitly requested.

## Brand Visual Language

Every crest direction must feel:

- Private
- Archival
- Premium
- Symbolic
- Family-oriented
- Gift-ready
- Calm
- Dignified

Every crest direction must avoid:

- Fake official heraldry
- Fantasy game art
- Sci-fi or mechanical logos
- Random geometry
- Meaningless visual clutter
- Disconnected circles or blocks
- Awkwardly cropped icons
- Identical duplicated variants

The visual standard is: a family should feel that the emblem was discovered through interpretation, not produced by a cheap icon generator.

## Core Composition Layers

Each crest is assembled from seven layers:

1. Outer frame
   Defines the silhouette and first read: shield, seal, plaque, book, compass, lantern, key, or modern emblem frame.

2. Inner field / division
   Organizes the visual space. Examples: single field, split field, arched field, root field, horizon field, archive panel.

3. Main symbol
   The dominant meaning carrier. Only one main symbol is allowed per crest.

4. Supporting symbols
   Secondary meaning carriers. They must support the main symbol and must not overpower it.

5. Ornament / border
   Adds dignity and recognition: laurel, branch, dots, corner flourishes, archive ticks, woven borders.

6. Ribbon / plaque / motto area
   A quiet grounding element. In MVP visual generation it must not contain AI-generated text.

7. Texture / palette / line style
   Adds archival depth: black-gold, ivory ink, parchment grain, restrained contrast, or print-friendly monochrome.

## Core Style Families

1. Classic Shield Archive
   A shield-led crest with inner gold border, central family symbol, restrained ornament, and archival black-gold palette.

2. Circular Legacy Seal
   A seal composition for recognition, gratitude, anniversary, and preservation-oriented collections.

3. Botanical Lineage Crest
   Branches, roots, vines, and growth symbols for continuity, renewal, home, and family lineage.

4. Memory Lantern Emblem
   Lantern, candle, star, and quiet light motifs for memory, grief, remembrance, and family story.

5. Compass / Journey Emblem
   Compass, path, mountain, wave, and north star motifs for immigration, journey, direction, and resilience.

6. Book / Wisdom Archive
   Book, archive box, quill, lamp, and page motifs for wisdom, education, storytelling, and record keeping.

7. Mountain / Resilience Crest
   Mountain, ridge, path, root, and horizon motifs for endurance, sacrifice, and family strength.

8. Key / Protection Emblem
   Key, gate, shield, door, and guardian star motifs for protection, home, and belonging.

9. Laurel Recognition Seal
   Laurel, wreath, plaque, and recognition motifs for parents, grandparents, retirement, and appreciation.

10. Minimal Luxury Monogram
   Refined mark-led layouts with initials or house-name space rendered server-side, never by the image model.

11. Gothic Archive Crest
   More formal archive geometry, pointed frames, heavier border language, and restrained historical texture.

12. Modern Black-Gold Symbolic Crest
   Contemporary black-gold compositions with simplified shapes, less ornament, and strong gift-ready presentation.

## Prohibited Visual Directions

The Crest Genome quality gate must reject or warn against:

- Random crossing lines
- Mechanical-looking masks
- Meaningless geometric clutter
- Game clan logos
- Sci-fi insignia
- Fake official coats of arms
- Over-complex unreadable shapes
- Disconnected circles or blocks
- Cropped awkward icons
- Identical duplicated variants

## Symbol Taxonomy

Symbols are never random. They are selected from mapped meaning themes.

### Protection

- shield
- key
- gate
- fortress
- oak door
- guardian star

### Continuity

- tree
- roots
- rings
- river
- thread
- vine
- spiral

### Unity

- knot
- joined branches
- ring
- woven cord
- clasp
- bridge

### Memory

- candle
- lantern
- book
- archive box
- star
- photograph frame

### Gratitude

- laurel
- open hands
- ribbon
- hearth
- morning star
- vessel

### Resilience

- mountain
- oak
- anchor
- ridge
- stone path
- flame

### Wisdom

- book
- owl silhouette
- compass
- lamp
- quill
- scroll

### Guidance

- compass
- north star
- lantern
- path
- lighthouse
- open gate

### Growth

- tree
- seedling
- vine
- branch
- sunburst
- rings

### Sacrifice

- flame
- candle
- clasped hands
- bridge
- shield
- stone

### Love

- heart knot
- joined branches
- hearth
- ring
- woven cord
- open hands

### Journey

- compass
- mountain
- path
- wave
- anchor
- north star

### Belonging

- home
- gate
- hearth
- joined branches
- circle
- bridge

### Craftsmanship

- hammer mark
- chisel line
- woven cord
- maker seal
- compass
- book

### Faith / Devotion

- candle
- lamp
- star
- chapel window
- open hands
- path

### Home

- hearth
- key
- door
- gate
- roofline
- oak door

### Legacy

- tree
- roots
- book
- laurel
- seal
- archive box

### Renewal

- seedling
- sunrise
- river
- branch
- spiral
- open gate

## Uniqueness Strategy

Every generated crest receives a visual signature:

```text
visual_signature = hash(
  template_id +
  frame_id +
  field_layout_id +
  primary_symbol_id +
  secondary_symbol_ids +
  ornament_ids +
  palette_id +
  texture_id +
  line_style_id +
  seed_salt
)
```

Rules:

- Use order id, meaning profile id, or a non-PII random salt as the deterministic seed source.
- Never use raw customer email in the signature.
- Store or compare visual signatures before final delivery once production integration exists.
- If a collision occurs, regenerate with a new salt.
- A single template cannot dominate all orders; template selection must be weighted by meaning themes, style preference, and rarity.
- The same seed and same input must reproduce the same crest.
- Different seeds must produce different signatures.

## Quality Gate

Hard failures:

- Invalid PNG
- Transparent PNG has no alpha
- Dimensions too small
- All variants identical
- No main symbol
- No frame
- Unsupported symbol appears
- Too many symbols
- Random geometry used
- Missing visual signature
- Duplicate signature in generated gallery
- Malformed file name

Warnings:

- Template too similar to another sample
- Symbol mapping weak
- Output too visually dense
- Output too minimal
- MVP deterministic template used

## Review Gallery Policy

The review gallery is internal-only and contains no customer data, no order tokens, no secrets, and no PII. It may be published under the existing public review path for Founder visual review, but it is not part of the customer product and must not be linked from public navigation.
