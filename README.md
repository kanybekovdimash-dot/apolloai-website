# ApolloAI Website Frontend

This repository contains the public `apolloai.biz` website, Meyram Cinema pages, the paired Cloudflare Worker, and Supabase schema files used by the project.

## What lives here

- static frontend pages for GitHub Pages
- public widget UI and casting flows
- Cloudflare Worker source in `local-worker`
- Supabase schema and admin-facing website assets
- public assets, styles, and interactions

## What does not live here

- production secrets
- Supabase private keys
- third-party API secrets

The public API is deployed separately to `https://apolloai-meyram-api.kanybekovdimash.workers.dev`.

## Local frontend development

```bash
npm install
npm run dev
```

## Production notes

- GitHub Pages serves the public frontend.
- `CNAME` points to `apolloai.biz`.
- The admin panel is published separately on `admin.apolloai.biz`.
- The site widget talks to the external API at `https://apolloai-meyram-api.kanybekovdimash.workers.dev`.
