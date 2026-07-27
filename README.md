# Game Guide Studio

Game Guide Studio is a loopback-only control plane for editing and publishing multiple game-guide sites. It keeps site identity, local repository roots, validation commands, and Vercel Git release rules in `sites.json`, while site-specific content behavior stays in adapters.

## Start

Requirements: Python 3.11 or newer and the registered game-site repositories on the same machine.

```powershell
python studio.py
```

Open `http://127.0.0.1:8770/studio/`.

Edit `sites.json` when repository roots, branches, Git remotes, or Vercel projects change. The checked-in registry contains the current `bagbattle` and `xwol` configuration for this workstation.

## Release CLI

Inspect, build, validate, and dry-run a release:

```powershell
python scripts/site_release.py status --site bagbattle
python scripts/site_release.py build --site bagbattle
python scripts/site_release.py validate --site bagbattle
python scripts/site_release.py plan --site bagbattle --files content/secrets/example-slug
```

`publish` stays in dry-run mode unless both `--execute` and `--confirm <siteId>` are supplied. It stages only explicit allowlisted paths and refuses existing staged changes, branch divergence, unapproved remotes, missing Vercel links, or failed validation.

## Codex Skill

The reusable `publish-game-guides` Skill is bundled under `skills/`. Its scripts locate this repository automatically when used in place. When installed elsewhere, set `GAME_GUIDE_STUDIO_ROOT` to this repository or keep it at one of the registered local installation paths.

## Deployment Boundary

This is a local administration tool, not a public web application. Keep the HTTP server on loopback. Vercel deployment applies to the registered guide sites through their Git integrations; Game Guide Studio itself should not be exposed on Vercel because it reads and writes local repositories.

XWOL is currently a release-only adapter. Its push remains blocked until its `origin` points to an owned repository and the local directory is linked to the correct Vercel project.
