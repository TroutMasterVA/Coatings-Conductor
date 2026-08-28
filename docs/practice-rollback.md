# Undo a bad release on a practice copy

The practice copy is a **Vercel preview**, not production and not `main`.

A bad practice release is undone by pointing that same preview host at the **previous preview**. Isaiah / the product owner must approve any final copy later.

Never:

- `main`
- grok.me
- production (`vercel --prod`, `vercel promote`, `vercel rollback`)

Env names for a lasting host already live in the README. This ticket does not turn on real hosting and does not put secrets in git.

## Plan

1. Save the current practice preview URL (the PR preview).
2. List recent deployments (`vercel ls --json` from a logged-in Vercel CLI).
3. Run the planner (no secrets, dry-run):

```bash
npm run practice:rollback -- --current https://your-preview.vercel.app --deployments deployments.json
```

It prints the previous preview and the alias command. It exits non-zero if the current URL is production, `main`, or grok.me, or if there is no older preview.

4. To apply, run the printed command yourself:

```bash
vercel alias https://previous-good-preview.vercel.app your-preview.vercel.app
```

That retargets the practice host. It does not merge, and it does not touch production.
