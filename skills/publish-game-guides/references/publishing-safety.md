# Publishing Safety

Before an actual push, verify all of the following:

1. The user explicitly authorized publishing, not merely editing, planning, or validating.
2. The selected `siteId`, displayed domain, repository root, branch, and remote all match the intended site.
3. Vercel is linked to the expected project.
4. The branch is synchronized with its upstream and has no unrelated unpushed commits.
5. There are no pre-existing staged changes.
6. Every staged path is in the explicit file list and the site's allowlist.
7. Article-level and site-wide validation pass.
8. The commit message describes only the scoped release.

The release script deliberately refuses broad repository-root staging, unapproved paths, remote mismatches, missing Vercel links, branch divergence, and existing staged content. Do not bypass these checks. A successful Git push triggers Vercel; verify deployment separately when the user asks for production verification.
