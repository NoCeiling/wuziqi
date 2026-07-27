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

## Hosted UI

The repository includes a static Vercel build for the Studio interface. The hosted interface connects to `http://127.0.0.1:8770`, while all repository access, validation, builds, and Git operations remain on this workstation. Start `python studio.py` before opening the hosted interface.

The loopback server accepts browser requests only from localhost, `wiziqigo.com`, `wuziqigo.com`, and origins explicitly added through `GAME_GUIDE_STUDIO_ORIGINS`. It supports the browser private-network preflight without exposing the server on a public network interface.

Build the hosted interface locally with:

```powershell
npm run build
```

The deployable output is written to `dist/`. Vercel hosts only these static files; it never receives the local site registry contents, Git credentials, or access to the registered repositories.

## Security Boundary

Keep the Python HTTP server on loopback. Vercel deployment hosts only the interface. The local server remains the control plane for editing and publishing the registered guide sites.

XWOL is currently a release-only adapter. Its push remains blocked until its `origin` points to an owned repository and the local directory is linked to the correct Vercel project.
