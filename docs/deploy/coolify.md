# Deploy on Coolify

yoru runs on [Coolify](https://coolify.io) v4 as a Docker Compose resource built straight from the repository. Coolify's proxy handles HTTPS and WebSockets, so there is nothing extra to configure for watch together rooms.

## 1. Create the resource

1. Open a project and an environment, then click **+ New**.
2. Choose **Public Repository** and enter `https://github.com/anivire/yoru`. For a private fork use **Private Repository (with GitHub App)** instead.
3. Set the branch to `master` and the **Build Pack** to *Docker Compose*.
4. Keep **Base Directory** at `/` and set **Docker Compose Location** to `/docker-compose.yml`, then continue.

Coolify reads the compose file and shows the `yoru` service.

## 2. Domain

In the resource's configuration, fill in the domain of the `yoru` service with the container port after a colon:

```
https://yoru.example.com:3000
```

The `:3000` only tells Coolify which port inside the container to route to; the site itself is served on the usual HTTPS port. Point the domain's DNS record at your Coolify server before deploying so the certificate can be issued.

## 3. Environment variables

Coolify lists the variables used in the compose file under **Environment Variables**. Set at least:

```env
APP_URL=https://yoru.example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=a-long-password
```

`APP_URL` must match the domain exactly, including `https://`: it is used for invite links, OAuth redirects and secure cookies. Any other variable from the [configuration table](../../README.md#configuration) can be set the same way, for example `ANIME365_TOKEN` or `KODIK_TOKEN`; empty ones fall back to their defaults. Tokens, OAuth keys and API addresses can also be set later in yoru's admin panel.

## 4. Deploy

Click **Deploy** and follow the build log. The first build takes a few minutes. When the container is up:

- with `ADMIN_USERNAME` and `ADMIN_PASSWORD` set, log in with them;
- without them, open the service **Logs**, find `[yoru] no admin yet, create one at …/invite/<code>` and open that link.

## Data and backups

The database and avatars live in the `yoru-data` named volume (Coolify prefixes its name with the resource id). It survives redeploys; do not delete volumes when removing the resource, or the data is lost.

Coolify's scheduled backups cover its own databases, not volumes of a compose resource, so back up the volume yourself, for example with a cron job on the server:

```bash
docker run --rm -v <volume-name>:/data -v /root/backups:/backup alpine \
  tar czf /backup/yoru-$(date +%F).tar.gz -C /data .
```

`docker volume ls | grep yoru-data` shows the full volume name.

## Updates

With the GitHub App, turn on automatic deployment to rebuild on every push. For a public repository, press **Redeploy** by hand or add the deploy webhook from the **Webhooks** tab to your fork. Migrations run on start. The footer in yoru shows the running version and commit and tells you when the branch is ahead.

## Troubleshooting

- **"No available server" or a 404 on the domain:** the domain is missing the `:3000` port, or is set on the wrong service.
- **Logged out right after logging in:** `APP_URL` does not match the address in the browser.
- **Watch together keeps reconnecting:** something in front of Coolify (for example a CDN or another proxy) is not forwarding WebSockets.
