# Backpack Battles

- Site ID: `bagbattle`
- Source root: `F:\bagbattle\bagbattle`
- Domain: `https://www.backpackbattles.top/`
- Expected branch and remote: `main`, `https://github.com/NoCeiling/bagbattle.git`
- Vercel project: `bagbattle`

Treat `content/secrets/<slug>/article.json` and localized Markdown in the same folder as article source. Do not hand-edit generated `articles/`, `secrets-data.js`, or sitemap output.

For recommendable build articles require:

- `buildItems.core`: at least one core completion item
- `buildItems.engine`: at least one opening or pivot signal
- `buildItems.transition`: at least one early or mid-game transition item
- `buildItems.support`: at least one support upgrade
- `buildNotes`: at least one player-facing caution
- `archetype`: a non-empty build name
- `recommendable`: `true` only after all required data is complete

Build with `python tools/secrets_cms.py build`. The registry validates Article Studio tests and the existing CMS test suite. Keep the separate deployment mirror out of the Vercel Git publish unless a user explicitly asks for mirror synchronization.
