# Deploy on Dokploy

yoru runs on [Dokploy](https://dokploy.com) as a Compose service built straight from the repository. Dokploy's Traefik proxy handles HTTPS and WebSockets, so there is nothing extra to configure for watch together rooms.

## 1. Create the service

1. Open a project (or create one) and click **Create Service → Compose**.
2. Give it a name, keep **Compose Type** on *Docker Compose*, and create it.
3. On the **General** tab choose the provider:
   - **GitHub**, if your GitHub account is connected to Dokploy: pick `anivire/yoru` (or your fork) and the `master` branch;
   - **Git** otherwise: repository URL `https://github.com/anivire/yoru.git`, branch `master`.
4. Set **Compose Path** to `./docker-compose.yml` and save.

## 2. Environment

On the **Environment** tab add at least the public address, and the first admin if you do not want to use the invite link from the log:

```env
APP_URL=https://yoru.example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=a-long-password
```

Dokploy writes these into a `.env` file next to the compose file, and the compose file passes them to the container. Any other variable from the [configuration table](../../README.md#configuration) can be added the same way, for example `ANIME365_TOKEN` or `KODIK_TOKEN`. Tokens, OAuth keys and API addresses can also be set later in yoru's admin panel.

`APP_URL` must match the domain from the next step exactly, including `https://`: it is used for invite links, OAuth redirects and secure cookies.

## 3. Domain

On the **Domains** tab click **Add Domain**:

| Field | Value |
|---|---|
| Service Name | `yoru` |
| Host | `yoru.example.com` |
| Path | `/` |
| Container Port | `3000` |
| HTTPS | on, certificate *Let's Encrypt* |

Point the domain's DNS record at your Dokploy server before deploying so the certificate can be issued. For a quick test you can generate a `traefik.me` domain instead.

## 4. Deploy

Click **Deploy** and follow the build in **Deployments**. The first build takes a few minutes. When the container is up:

- with `ADMIN_USERNAME` and `ADMIN_PASSWORD` set, log in with them;
- without them, open **Logs**, find `[yoru] no admin yet, create one at …/invite/<code>` and open that link.

## Data and backups

The database and avatars live in the `yoru-data` named volume, which survives redeploys and rebuilds. Do not remove volumes when deleting or recreating the service, or the data is lost.

To keep copies, add a **Volume Backup** for `yoru-data` with an S3 destination (destinations are set up under **Settings → S3 Destinations**).

## Updates

Turn on **Autodeploy** on the **General** tab to rebuild on every push to the branch, or press **Deploy** by hand. Migrations run on start. The footer in yoru shows the running version and commit and tells you when the branch is ahead.

## Troubleshooting

- **404 or "Bad Gateway" on the domain:** check that the domain's service name is `yoru` and the container port is `3000`.
- **Logged out right after logging in:** `APP_URL` does not match the address in the browser, or uses `https://` while the domain has HTTPS off.
- **Watch together keeps reconnecting:** something in front of Dokploy (for example a CDN or another proxy) is not forwarding WebSockets.
