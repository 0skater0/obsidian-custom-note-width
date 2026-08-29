---
custom-width: 38
---

# Custom Width — 42%

This note has `custom-width: 42` — a value that **does not match any pill preset**. In Pills mode, **no pill is highlighted** because the current width is custom.

## Expected behaviour

- Pills mode: none of the three pills show the active state
- Clicking any pill overrides this custom value with the preset
- To get back to 42, edit the YAML field manually (or use the slider in Slider mode)

## Why this matters

Pills are not a memory of the last pressed button — they reflect the *actually applied* width. This keeps the UI honest: if you see a highlighted pill, the note really is at that preset. If none is highlighted, the width is custom.

## Sample content

The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. Sphinx of black quartz, judge my vow.

> A blockquote at 42% width — slightly narrower than the default 50% middle pill.
