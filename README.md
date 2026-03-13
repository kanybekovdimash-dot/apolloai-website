# ApolloAI Website Frontend

This repository now contains only the public frontend for `apolloai.biz` and the Meyram-branded landing page.

## What lives here

- static frontend pages for GitHub Pages
- public widget UI
- client-side call to `https://api.apolloai.biz`
- public assets, styles, and interactions

## What does not live here

- Worker backend code
- Telegram bot secrets
- Groq keys
- RunPod or avatar server config

The backend stays outside this repository and is deployed separately to `api.apolloai.biz`.

## Local frontend development

```bash
npm install
npm run dev
```

## Production notes

- GitHub Pages serves only the frontend.
- `CNAME` points to `apolloai.biz`.
- Public brand can remain `Meyram` while the technical domain is `apolloai.biz`.
- Existing WhatsApp links on the site stay untouched.
- The site widget is text-first and talks to the external API at `api.apolloai.biz`.
