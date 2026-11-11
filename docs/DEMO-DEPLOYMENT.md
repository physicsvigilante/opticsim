# opticsim standalone browser demo

**Status:** The static demo is built and tested in this repository. It is **not
automatically deployed**. Publishing to an internet-accessible URL requires
separate explicit public-visibility approval.

## Download a ready-to-host package (no Node.js for visitors)

The standard [Optical composition checks](../.github/workflows/opticsim-ci.yml)
workflow builds the unchanged PhyDemo engine and creates the
**opticsim-demo-site** artifact when all tests pass. Open the successful GitHub
Actions run, download the ZIP under **Artifacts**, and extract it. The package
contains the browser application, all bundled examples, styles, `.nojekyll`,
and the required third-party licenses. It deliberately excludes Git repository
files, `vendor/`, `test-core.cjs`, `.env`, caches and test results.

The resulting directory is a **static website**: no Node.js, API, GitHub token,
or running server is needed on the host. Visitors only need a current browser.
A host must serve it over HTTPS at a path ending in `/` (or redirect a bare
project path to that form) and provide the assets unchanged. Opening
`index.html` directly via `file://` is **not supported**, because browsers
restrict loading bundled example JSON from local files.

To build the same package locally:

```powershell
npm run setup
npm run demo:package
```

Files are generated inside the ignored
`test-artifacts/demo-site/` directory. The regular `npm start` still runs the
local test server at `http://127.0.0.1:4173/`. To reproduce a GitHub project
URL prefix locally after packaging:

```powershell
$env:OPTICSIM_BASE_PATH = '/opticsim/'
$env:OPTICSIM_SERVE_DEMO = '1'
npm start
```

Open `http://127.0.0.1:4173/opticsim/?scene=multi-source-four`.
The CI hosted smoke test uses this same nested-path setup to validate working
rays, scene downloads, safe example links, and bundled-only requests.

## Browser demo capabilities and privacy boundary

All native rays, parameters, detectors and independent analysis run entirely
in the **visitor's browser**. The page fetches example JSON and static resources
only from its own origin, with a restrictive Content Security Policy. **Open
sandbox** uses the local file chooser, and **Save sandbox** and **Export PhyDemo
JSON** download directly to the visitor; there is no upload endpoint or
server-side store. No API key, remote LLM service, analytics or authentication
are bundled.

Examples can be linked with `?scene=single-lens`,
`?scene=mixed-two-lens-two-mirror`, or `?scene=multi-source-four`. The
**Share starting example** link references **only an existing example name**.
It does not encode the current edited values, detector data, or user-loaded
files. To share an *edited* scene, download the sandbox JSON and transfer it
through a separately chosen channel. Unsupported query values revert to the
single-lens example instead of fetching arbitrary paths.

The site is a public-facing **compiled JavaScript application**, regardless
of whether the source repository stays private. Its bundled client code and
example JSON are inspectable by anyone able to load the page. Do **not** place
credentials, private exam material, user uploads, or secrets in the bundle.

## Optional GitHub Pages publication — requires explicit public approval

The repository includes the **Publish opticsim demo (manual public opt-in)**
GitHub Actions workflow. It has **no push, PR or merge trigger** and cannot
publish merely because code is merged.

1. Check your GitHub plan supports Pages from a private repository (GitHub Pro,
   Team, or Enterprise; GitHub Free generally requires a public repository).
   Keep `physicsvigilante/opticsim` **private**.
2. Decide whether a **publicly viewable site** is acceptable. On ordinary
   GitHub Pages plans, a Pages site can be public even when the repository
   remains private. Private **site** access control is a separate
   GitHub Enterprise Cloud organization feature; do not assume repo privacy
   makes the website private.
3. After specifically approving publication, set **Repository → Settings →
   Pages → Build and deployment → Source: GitHub Actions**. GitHub Settings
   is not changed by a PR in this project.
4. Under **Actions**, manually run **Publish opticsim demo (manual public
   opt-in)** against `main`. Choose `public-site-approved` *only after*
   deciding to make the compiled demo publicly accessible. The default
   `do-not-publish` choice skips deployment.
5. The workflow builds from the exact pinned PhyDemo core, tests the website
   at `/opticsim/`, uploads only the isolated static package and deploys it
   to the `github-pages` environment. If Pages is unsupported/disabled, the
   workflow may fail and **no site URL should be claimed**.
6. After a successful deployment, GitHub displays the **actual** Pages URL in
   the deployment job and Settings → Pages. A typical project URL is
   `https://physicsvigilante.github.io/opticsim/`, but it is **not a
   verified live link until GitHub reports a successful deployment**.

The deployment permission is limited to the manual job
(`contents: read`, `pages: write`, `id-token: write`). No deployment
secrets, external hosting service or changes outside this repository are used.

If you require a restricted-access live URL without GitHub Enterprise Cloud
Pages site access control, **do not run the public Pages workflow**; choose and
approve a suitable access-controlled host separately. This milestone does not
set up another service or make the repository public.
