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
