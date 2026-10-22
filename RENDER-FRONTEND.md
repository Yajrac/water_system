# Render admin frontend

Create a separate **Static Site**, using the same repository and branch as the API.

| Setting | Value |
| --- | --- |
| Root Directory | Leave empty |
| Build Command | `node scripts/build-frontend.mjs` |
| Publish Directory | `dist-frontend` |

Commit and push the build script and current frontend API configuration first.
The build requires Node.js but no npm installation. Only the public frontend folders
and required JSON assets are copied. The root index redirects to `/html/login.html`.
This admin frontend does not package the separate consumer app.

After Render assigns the Static Site URL, add its exact HTTPS origin to the API
web service's `CORS_ORIGINS`, separated by commas from any retained Live Server
origins. Save and redeploy the API, then open the static site's login page.
Do not add a path or trailing slash to CORS origins. Keep database credentials,
JWT secrets and the database certificate on the API service only.

`js/shared/api-config.js` targets `https://water-system-1.onrender.com/api/v1`.
For local API testing, set `useLocalAdminApi = true` and preview on localhost.
When switching API databases, log out and sign in again.

For browser testing of the consumer app with Expo Web, also add its exact origin
(usually `http://localhost:8081` or `http://127.0.0.1:8081`) to the Render API's
`CORS_ORIGINS`. Keep the admin site origin in the same comma-separated value.
Use the port shown by Expo if different. A successful health check does not prove
that browser login is allowed; missing CORS headers can still block login fetches.


## Custom not-found page

The build copies `html/404.html` to `dist-frontend/404.html`. The error page uses root-relative links so styling and navigation work at nested missing URLs. After deployment, check a missing path such as `/html/missing-page.html` and verify the HTTP response and custom page. Existing catch-all redirects/rewrites may take precedence; remove any old `/*` rule pointing to the login/dashboard if it hides missing pages.

VS Code Live Server is configured through `.vscode/settings.json` to display `html/404.html` for missing files. Stop and restart Live Server after changing its configuration. Its fallback displays the page but may return HTTP 200; use the preview server below to verify real HTTP 404 responses. Run these commands from the repository root:

```sh
node scripts/build-frontend.mjs
node scripts/preview-frontend.mjs
```

Open `http://127.0.0.1:5501/html/index.html/?` or `/missing/page` to test the 404. This local preview serves only `dist-frontend`. For authenticated local API requests, add `http://127.0.0.1:5501` to the local server's `CORS_ORIGINS` if it is not already allowed, then restart the API. A 404 page is error handling; authentication, authorization and parameterized queries remain the API protections.
