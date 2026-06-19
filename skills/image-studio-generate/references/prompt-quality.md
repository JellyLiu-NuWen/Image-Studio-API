# Prompt Quality Guide

Use this guide before calling the Image Studio API for production images, especially when the user gives a short or vague request.

## Core Rule

Do not send the user's raw one-line request unless it is already a production prompt. Rewrite it into a concrete visual brief that names the subject, composition, style, text requirements, aspect ratio, and constraints.

## Classify First

Pick the closest output type, then write the prompt around that type's failure modes:

- UI or app screenshot: platform, screen type, layout regions, exact visible text, readable typography, no mixed platform chrome.
- Infographic or technical diagram: title, audience, module count, hierarchy, labels, arrows or legends, no fake unreadable microtext.
- Poster or campaign: main visual, headline, subtitle, hierarchy, palette, texture, social ratio.
- Product image: product identity, angle, material, lighting, background, scale, labels or callouts.
- Brand or packaging: logo/mark behavior, color system, typography, applications, avoid generic marks.
- Photo realism: camera distance, lens feel, lighting, environment, natural imperfections, no plastic skin or overprocessing.
- Illustration or scene: story beat, mood, environment, composition, rendering medium.
- Character or avatar: consistent identity, pose, outfit, expression, style, background.
- Academic or engineering figure: precise layout, labels, conservative colors, no invented numeric data.

## Prompt Shape

For complex layouts, use a structured JSON-like prompt. Keep it as the prompt text, not the API payload:

```json
{
  "type": "output type",
  "goal": "where the image will be used",
  "subject": "main subject and fixed identity",
  "scene": "environment, lighting, mood",
  "layout": "canvas ratio, regions, hierarchy, placement",
  "style": "medium, palette, material, typography",
  "text": "exact visible words, label rules, language",
  "constraints": "must keep, must avoid, quality checks"
}
```

For simple images, a compact paragraph is fine, but still include:

1. Subject and action
2. Composition and camera/framing
3. Lighting, material, palette, style
4. Output ratio and quality target
5. Negative details to avoid

## Defaults

- Quality: use `high` unless the user prioritizes speed or cost.
- Count: use `1` unless the user asks for variants.
- Size: use `1024x1024` for square assets, `1024x1536` for portrait posters, `1536x1024` for landscape banners when the upstream supports these sizes.
- Language: match the user's language for visible text and final prompt unless they ask otherwise.

## When To Ask

Ask only when missing information would likely ruin the output:

- The subject, product, person, or core theme is missing.
- Exact text must appear but the text is not supplied.
- The requested style and use case conflict.
- A reference image is required but not provided.

Otherwise choose reasonable defaults and proceed.

## Iteration

If quality is poor, do not rerun the same prompt. Inspect the saved metadata, identify the failed dimension, and revise one layer:

- Composition failed: add region counts, placement, and hierarchy.
- Text failed: shorten visible text and state "exact text only".
- Subject drifted: repeat fixed identity and invariant traits.
- Style looked generic: add medium, era, material, lighting, and palette.
- Clutter appeared: add module count, whitespace, and negative constraints.
