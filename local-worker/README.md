# Local Worker Deploy

This folder is local-only and is not pushed to GitHub.

## Recommended auth path

Preferred:
1. Open: https://dash.cloudflare.com/profile/api-tokens
2. Create token from template: `Edit Cloudflare Workers`
3. Save it into `.cloudflare.env`

```env
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=412db0cf9cffd7b9e634b190bcbf5fed
```

## Fallback auth path

If `Create Token` does not work, use your Global API Key from the same page. Cloudflare's Wrangler docs still support `CLOUDFLARE_EMAIL` + `CLOUDFLARE_API_KEY` for older authentication.

```env
CLOUDFLARE_ACCOUNT_ID=412db0cf9cffd7b9e634b190bcbf5fed
CLOUDFLARE_EMAIL=your_email_here
CLOUDFLARE_API_KEY=your_global_api_key_here
```

## Deploy to Cloudflare

```powershell
./deploy.ps1
```

The script reads `.cloudflare.env`, uploads non-empty values from `.dev.vars` as Worker secrets, then runs `wrangler deploy`.

Expected production domain: `https://api.apolloai.biz`
