# Browser demo deployment (Milestone 5)

## What is included

The existing `npm run build` emits only browser files under `dist/`:
`index.html`, `app.js`, `style.css`, `scenes/*.json`, attribution under
`licenses/` and the `.nojekyll` marker. PhyDemo traces and renders
all rays in the visitor's browser. No runtime server API, Node.js,
authentication, remote ray tracing or CDN is needed once hosted.

**A private GitHub repository does not make its GitHub Pages site private.**
Ordinary Pages sites are publicly accessible. Some GitHub Enterprise Cloud
organizations support restricted Pages access as a separate feature.
Visitors can download the published app JS and authored example scenes.
The deploy action does **not** upload repository history, tests, Git metadata,
build tools, private source files or installed upstream dependencies.

## Safe qualification without making the demo public

The CI workflow automatically runs the pinned setup, all native tests,
production build, `scripts/check-static-demo.mjs` and a real Chrome
`--demo-smoke` test at `/opticsim/`. It also runs the original full
browser acceptance suite at `/`. The smoke test verifies assets,
native rays, multiple sources, detector measurements, parameter editing,
sandbox Save/Open, native export and relative project paths.

CI uploads two **private GitHub Actions artifacts**:
`opticsim-static-demo-site` (the browser-only build) and
`static-demo-acceptance-evidence` (reports/screenshots).
No deployment workflow is triggered by pushing or opening a PR.

## Publishing only after explicit public-site approval

Do not follow these steps before the user separately approves publishing
a public website and approves merging the Milestone 5 PR.

1. Confirm your GitHub plan supports GitHub Pages from a **private** repository
   (typically GitHub Pro, Team or Enterprise). Do not switch the source repo
   to public merely to deploy a demo.
2. In `physicsvigilante/opticsim`, open **Settings → Pages**. Select
   **Build and deployment → Source: GitHub Actions**. Confirm that the
   website's visibility matches the intended access policy.
3. Optionally protect the `github-pages` deployment environment so only
   `main` and approved reviewers can deploy.
4. Open **Actions → Publish browser demo (manual approval only)** and
   choose **Run workflow** on branch `main`. Enter exactly
   `PUBLISH_PUBLIC_DEMO` in the approval field. Its default `NO` fails
   before upload or deployment.
5. Check the deployment job for the actual URL. A normal GitHub project Pages
   address is often `https://physicsvigilante.github.io/opticsim/`,
   but this is **not a verified live URL** until deployment succeeds.
6. Verify access in an incognito window and exercise the native simulator,
   examples, saving, loading and attribution before sharing the link.

The publishing workflow is **manual dispatch only** and is restricted to
`main`. It rebuilds and checks the site before uploading **only `dist/`**
through GitHub's official Pages artifact actions. It never modifies
the repository's Pages settings.

## Local project-path smoke test

From the existing Windows PowerShell setup:

```powershell
npm run setup
npm run build
npm run check:demo
$env:OPTICSIM_BASE_PATH = '/opticsim/'
npm start
```

Open `http://127.0.0.1:4173/opticsim/`. Clear the environment
variable before returning to the regular local root address.

## Scope and limits

This is a static deployment of the existing bounded 2D optical sandbox.
There is no live AI request service, remote scene database, server-side image
processing, cloud account, or user authentication. Opening a downloaded
`index.html` directly as `file://` can fail due to JSON fetch restrictions;
HTTP hosting is required. Passing CI does not establish that a public
Pages site is enabled, configured or reachable.
