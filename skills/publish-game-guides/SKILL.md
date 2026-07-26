---
name: publish-game-guides
description: Select, inspect, validate, and publish content to registered game-guide websites through their Vercel Git integrations. Use when working with Game Guide Studio, choosing between bagbattle and XWOL, checking an article release, preparing an explicit file-scoped commit, pushing guide content, or diagnosing why a guide-site publish is blocked.
---

# Publish Game Guides

Resolve Game Guide Studio through `GAME_GUIDE_STUDIO_ROOT`, the repository containing this bundled Skill, or a known local installation. Use its `sites.json` as the registry and require an explicit `siteId` before any write or release action.

## Workflow

1. Run `python scripts/inspect_site.py --site <siteId>` before editing or publishing. Report the site name, domain, root, branch, remote, Vercel project, dirty-file count, and blockers.
2. Read the matching site reference before changing content:
   - `bagbattle`: read `references/bagbattle.md`.
   - `xwol`: read `references/xwol.md`.
3. Edit only the site's source of truth. Preserve unrelated dirty changes and never edit generated outputs directly unless the site reference identifies them as release outputs generated from a source change.
4. For a Backpack Battles article, run `python scripts/validate_article.py --site bagbattle --slug <slug>` before the site-wide checks.
5. Run the registered content build with `python scripts/site_cli.py build --site <siteId>`, then run the validation commands with `python scripts/site_cli.py validate --site <siteId>`.
6. Inspect the post-build changes and produce a dry-run for every explicit source and generated path with `python scripts/publish_site.py --site <siteId> --files <path...> --message "<message>"`. Show the domain, branch, files, and all blockers to the user.
7. Execute only when the user has explicitly asked to publish or push. Re-run with `--execute --confirm <siteId>` after the dry-run is clean.

Read `references/publishing-safety.md` before an actual push.

## Hard Rules

- Never infer the site from the current directory when more than one registered site is in scope.
- Never use `git add .`, stage pre-existing unrelated changes, switch remotes, run `vercel link`, or alter Vercel project ownership automatically.
- Treat a wrong or unapproved Git remote, missing Vercel link, branch divergence, existing staged changes, failed validation, or an empty explicit file list as a release blocker.
- Use Git push only as the Vercel deployment trigger. Do not claim production is live merely because the push succeeded; report that Vercel deployment has been triggered.
- If push fails after commit, report that the commit remains local and do not create another commit.
