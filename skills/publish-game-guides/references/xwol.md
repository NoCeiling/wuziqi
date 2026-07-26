# XWOL

- Site ID: `xwol`
- Source root: `F:\XWOL\xwol-site`
- Domain: `https://xiwanggame.cn/`
- Expected branch: `master`
- Deployment provider: Vercel

Guide index source currently lives in `src/content/guides.ts`; structured article bodies live in `src/content/guide-articles.ts`. Generated content under `content/generated/` is produced by the content pipeline.

Run `npm run content:build`, `npm run content:verify`, and `npm run check` according to the registered workflow. Read `F:\XWOL\xwol-site\AGENTS.md` and the relevant bundled Next.js 16 documentation before changing application code.

Publishing is intentionally blocked until both conditions are fixed by the owner:

- `origin` must no longer point to `https://github.com/JCodesMore/ai-website-cloner-template.git`; register the owned repository URL in `sites.json`.
- Link the local directory to the correct Vercel project so `.vercel/project.json` identifies that project.

Do not change either setting automatically. The shared studio currently exposes XWOL as a release-only adapter; do not promise Article Studio editing for this site until its TypeScript content schema has a durable adapter.
