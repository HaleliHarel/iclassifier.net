# iClassifier Dictionary + Deployment Runbook

This runbook covers:
- Running the Egyptian dictionary Docker service locally
- Running it on server for production
- Wiring the app so local/dev/prod all work without code changes
- Pushing your current version to GitHub
- Testing on `iclassifier.net`

## 1) Dictionary integration in this app

The frontend calls:
- `/api/dictionary/:dictId/byid?id=...`

The backend proxy is:
- `server/routes/dictionary-proxy.ts`

The proxy now tries dictionary URLs in order:
1. `DICTIONARY_URLS` (if set, comma-separated)
2. `DICTIONARY_URL` (if set)
3. `http://127.0.0.1:8090`
4. `http://dictionary:8090`

This gives smooth behavior in both:
- host development (`127.0.0.1:8090`)
- Docker network setup (`dictionary:8090`)

## 2) Local development (recommended)

From `iclassifier_testing_clone`:

```bash
docker compose -f docker-compose.dictionary.yml up -d
npm run dev
```

Check dictionary is reachable through your app proxy:

```bash
curl "http://127.0.0.1:8000/api/dictionary/egyptian/byid?id=1"
```

If your app uses another port, replace `8000`.

Stop dictionary service:

```bash
docker compose -f docker-compose.dictionary.yml down
```

## 3) Production server (app on host, dictionary in Docker)

On the server:

```bash
cd /path/to/iclassifier_testing_clone
docker compose -f docker-compose.dictionary.yml up -d
```

Run your app with:
- `DICTIONARY_URL=http://127.0.0.1:8090`

If you already use `.env`, this is already the default.

## 4) Production server (app and dictionary both in Docker)

If app container and dictionary container are on the same Docker network:
- set `DICTIONARY_URL=http://dictionary:8090`

Optionally set:
- `DICTIONARY_URLS=http://dictionary:8090,http://127.0.0.1:8090`

## 4b) Frontend subpath deployment (`/app` under `iclassifier.net`)

Use this when your main homepage remains at `/` and this app is mounted at `/app`.

1. Build the SPA for the mounted path:

```bash
cd /path/to/iclassifier_testing_clone
VITE_BASE_PATH=/app/ npm run build:client
```

2. Keep API base explicit so requests match your routing strategy:

- App and API both under `/app`:

```bash
VITE_API_URL=/app/api npm run build:client
```

- App under `/app`, API still at `/api`:

```bash
VITE_API_URL=/api npm run build:client
```

3. If using nginx, map `/app/` to the built `dist/spa` folder or reverse-proxy to your app container, while keeping `/` traffic unchanged for the existing homepage.
4. Validate:

```bash
curl "https://iclassifier.net/app/api/ping"
curl "https://iclassifier.net/app/"
```

## 4c) Frontend subpath deployment (`/iclassifier` under `iclassifier.net`)

For backward compatibility, keep this if you previously used `/iclassifier`:

1. Build with:

```bash
VITE_BASE_PATH=/iclassifier/ VITE_API_URL=/iclassifier/api npm run build:client
```

2. Validate:

```bash
curl "https://iclassifier.net/iclassifier/api/ping"
curl "https://iclassifier.net/iclassifier/"
```

## 5) Push your current version to GitHub

From repo root:

```bash
git status
git add iclassifier_testing_clone/client/components/ReportActions.tsx \
        iclassifier_testing_clone/client/lib/reportUtils.ts \
        iclassifier_testing_clone/server/routes/dictionary-proxy.ts \
        iclassifier_testing_clone/.env \
        iclassifier_testing_clone/.env.example \
        iclassifier_testing_clone/docker-compose.dictionary.yml \
        iclassifier_testing_clone/DEPLOYMENT_DICTIONARY_RUNBOOK.md
git commit -m "Improve screenshot export and add robust dictionary local/prod setup"
git push origin <your-branch>
```

Then open/merge your PR (or push directly to your deployment branch).

## 6) Test on `iclassifier.net`

After deployment:

1. Open a lemma page that shows dictionary data.
2. Verify browser Network tab has `200` on:
   - `/api/dictionary/.../byid?id=...`
3. SSH into server and verify dictionary container:

```bash
docker ps | grep iclassifier-dictionary
docker logs --tail=100 iclassifier-dictionary
```

4. Verify app can reach dictionary from server:

```bash
curl "http://127.0.0.1:8090/dictionary/egyptian/byid?id=1"
curl "http://127.0.0.1:<app-port>/api/dictionary/egyptian/byid?id=1"
```

If first works but second fails, app env/proxy config is wrong.
