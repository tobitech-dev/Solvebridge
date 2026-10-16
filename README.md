# SolveBridge

People describe a problem that technology could solve (name, email, country, problem, optional image). Only you, the admin, can read the submissions.

Stack: plain HTML, CSS and JavaScript, Vercel serverless functions in `api/`, MongoDB.

## Files

```
solvebridge/
├── index.html        Public form
├── thank-you.html    Shown after a successful submit
├── login.html        Admin sign in
├── dashboard.html    Admin submissions list
├── style.css         Shared styles
├── admin.css         Login and dashboard styles
├── form.js           Form logic, image shrinking, submit
├── login.js          Admin sign in
├── dashboard.js      List, search, filter, status, delete
├── logo.svg          Logo and favicon
├── vercel.json       Security headers and clean URLs
├── package.json      Dependencies (mongodb, jsonwebtoken)
├── .env.example      Names of the environment variables
└── api/              Backend (Vercel requires this folder name)
    ├── _db.js        MongoDB connection
    ├── _auth.js      Admin session helpers
    ├── submit.js     Public: save a submission
    ├── login.js      Admin: sign in
    ├── logout.js     Admin: sign out
    ├── submissions.js  Admin: list, change status, delete
    └── image.js      Admin: view an attached image
```

## Environment variables

Set these in Vercel: Project, Settings, Environment Variables. Never put them in the code or send them in chat.

| Name | What it is |
| --- | --- |
| `MONGODB_URI` | Your MongoDB connection string |
| `MONGODB_DB` | Database name, for example `solvebridge` |
| `ADMIN_PASSWORD` | The password you type on the sign in page |
| `JWT_SECRET` | Random string of 32+ characters. Create one with `openssl rand -hex 32` |

## Deploy

1. In MongoDB Atlas, open Network Access and allow `0.0.0.0/0`. Vercel uses changing IP addresses, so a fixed allow list will not work.
2. Create a Vercel project from this folder (upload it to GitHub and import it, or run `vercel` with the Vercel CLI).
3. Add the four environment variables above, then redeploy.
4. Open `/login`, sign in, and send yourself a test problem from the home page.

## Run locally

```
npm install
npm i -g vercel
vercel dev
```

Put the variables in a `.env.local` file first (copy `.env.example`).

## Security notes

- The admin password and the cookie secret exist only as Vercel environment variables.
- The session is an HttpOnly, Secure, SameSite=Strict cookie that lasts 8 hours.
- Five wrong passwords lock that IP out for 15 minutes.
- Each IP can send 5 problems per hour. Visitor IPs are stored only as a keyed hash.
- Uploaded images are re-encoded in the browser, then checked on the server (type, size, file signature) and are served only to a signed-in admin.
- Rotate `ADMIN_PASSWORD` and `JWT_SECRET` in Vercel whenever you want to sign everyone out.
