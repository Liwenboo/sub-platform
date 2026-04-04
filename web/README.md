This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Admin auth (minimal)

This project includes a controlled access auth baseline inside the Next app:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `src/proxy.ts` guards admin pages and admin mutation APIs

Required environment variables:

```bash
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-admin-password
SESSION_SECRET=replace-with-a-long-random-secret
```

Optional environment variables:

```bash
SESSION_TTL_SECONDS=28800
VIEWER_ACCESS_MODE=authenticated
AUTH_MAX_FAILURES=5
AUTH_WINDOW_SECONDS=300
AUTH_BLOCK_SECONDS=300
```

`VIEWER_ACCESS_MODE`:

- `anonymous`: viewer pages and read APIs can be accessed without login.
- `authenticated` (default): viewer pages and read APIs also require login.

For backward compatibility, `SUB_PLATFORM_*` prefixed names are also accepted.

### Local setup

1. Create `.env.local` in project root.
2. Add the required variables above.
3. Start dev server with `npm run dev`.

### Cloud/server deployment setup

1. Configure env vars in your platform (Docker, systemd, PM2, Vercel, etc.).
2. Ensure `SESSION_SECRET` is a strong random string and never checked into git.
3. Build and run:
   - `npm run build`
   - `npm run start`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
