# Agent guide

These instructions apply to the entire repository. Follow the user's task and preserve unrelated changes already present in the working tree.

## Project overview

Lithuanian Words is a static vocabulary trainer for Russian-speaking learners. It uses native JavaScript modules, HTML, CSS, and JSON. There is no application build step, backend, or runtime framework. Prettier is a local development dependency, not part of the browser app.

- Keep user-facing text in Russian and Lithuanian learning content in Lithuanian.
- Write code comments and repository documentation in English, following the existing style.
- Preserve local progress, backup compatibility, and offline behavior when making changes.
- Keep changes focused. Do not introduce a framework, build system, or additional dependency for a task that the existing architecture can handle.

## Repository map

| Path                                         | Responsibility                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `index.html`                                 | App shell, navigation, backup dialog, versioned asset references        |
| `js/app.js`                                  | Rendering, event handling, search, theme filters, speech, and startup   |
| `js/core.js`                                 | Progress storage, local dates, review scheduling, and backup validation |
| `js/theme.js`                                | Light/dark appearance and theme persistence                             |
| `styles.css`                                 | Responsive layout and light/dark styles                                 |
| `data/words.json`                            | Dictionary entries and their stable IDs                                 |
| `data/themes.json`                           | Theme IDs and Lithuanian/Russian names                                  |
| `sw.js`                                      | Offline asset bundle, cache updates, and fetch fallbacks                |
| `manifest.webmanifest`, `icons/`, `icon.svg` | PWA metadata and icons                                                  |
| `scripts/check-assets.js`                    | Dictionary references and asset limits                                  |
| `scripts/set-version.js`                     | Version synchronization and consistency checks                          |
| `tests/core.test.js`                         | Progress and review logic tests                                         |
| `tests/version.test.js`                      | Version synchronization tests                                           |
| `tests/browser-smoke.py`                     | Browser integration checks using an isolated profile                    |

## Setup and commands

Run commands from the repository root. Development requires Node.js 20.11+ and npm. Python 3 is needed for the local server and browser smoke test. The app itself can be served without installing npm dependencies.

```sh
npm ci
```

Use the lockfile to install the pinned development dependencies. Do not install Prettier globally. In Windows PowerShell, use `npm.cmd` instead of `npm` if execution policy blocks `npm.ps1`; changing execution policy is unnecessary.

| Command                         | Purpose                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`                   | Serve the repository at `http://localhost:8000` using `python3`                                   |
| `npm test`                      | Run all `tests/*.test.js` files with Node's built-in test runner                                  |
| `npm run check`                 | Check file limits, theme definitions, duplicate word IDs, theme references, and local media paths |
| `npm run format`                | Apply Prettier to supported files, respecting `.prettierignore`                                   |
| `npm run format:check`          | Check formatting without changing files                                                           |
| `npm run version:set -- 0.1.13` | Set an explicit release version across all versioned files; the number is an example              |
| `npm run version:check`         | Check version consistency against `package.json`                                                  |
| `python tests/browser-smoke.py` | Run browser integration checks separately from `npm test`                                         |

If `python3` is unavailable on Windows, start the server with `py -m http.server 8000` or `python -m http.server 8000`. The browser test can likewise be run with `py` or `python3` when that is the available Python launcher.

Open the app through HTTP, not `file://`. Asset paths are absolute from `/`, so serve the repository as the site root. A deployed PWA needs a secure context; localhost is suitable for development.

## Code style

- Follow `.prettierrc.json`, `.editorconfig`, and `.gitattributes`: UTF-8, LF, two-space indentation, JavaScript single quotes, and trailing commas. Python uses four spaces.
- Keep the `/* HTML */` annotations on HTML template literals so Prettier formats their markup.
- Preserve escaping when interpolating dictionary content into HTML; use the existing `escape` helper in `js/app.js`.
- Use `js/core.js` for progress/date logic and `js/app.js` for browser interaction. Keep core behavior testable without a DOM.
- `data/`, icons, and `package-lock.json` are excluded from automatic Prettier formatting. Preserve dictionary ordering and avoid unrelated data reformatting.
- Commit shared configuration, `package-lock.json`, scripts, and tests. `node_modules/` remains ignored.

## Behavioral contracts

### Progress and dictionary data

- Word IDs are persistent keys in saved progress. Renaming or removing IDs can hide studied words and prevent old backups from importing. Provide an explicit migration when such a change is part of the task.
- Preserve the storage key and schema unless the task includes a compatible migration. Never silently replace unreadable progress with empty data.
- Review dates use local calendar days through `localDay` and `addDays`. Do not replace them with UTC date slicing or fixed millisecond offsets.
- Keep word IDs unique and `theme` references valid. Theme IDs and both language names come from `data/themes.json`.
- Follow the README's theme assignment rules. Do not add new themes outside the agreed task scope.
- Preserve Lithuanian diacritics, stress marks, forms, and example translations. Do not change dictionary text as a side effect of refactoring.
- `npm run check` does not validate every dictionary field or prove linguistic correctness. Inspect edited entries as well as running it.

### Interface

- The All words catalog combines prefix search over `word`, `displayWord`, and `translation` with the selected word themes. Search is case-insensitive and NFC-normalized.
- Theme checkboxes initially select every theme; selecting none shows an empty list. The theme dropdown starts collapsed. Search and selected themes survive tab/card navigation until reload.
- Opening a catalog card does not change study progress. Adding it to study does not move the New words position. Returning restores catalog focus and scroll position.
- Preserve light/dark appearance, keyboard focus, accessible labels, and narrow-screen layout. Review answers must remain hidden until revealed.

### Offline assets and versions

- Treat `package.json` as the release version source of truth. Use `npm run version:set -- X.Y.Z` with a numeric release version instead of editing version copies manually. The script also updates the root lockfile version, app version, HTML asset URLs, and service worker cache/asset URLs. It does not create a commit or tag.
- When preparing changes to cached application assets for delivery, update the release/cache version with that command. Documentation-only changes do not need a version bump.
- If a new file is required offline, add it to `CORE` in `sw.js`. If the versioned asset layout changes, update `scripts/set-version.js` and its tests too.
- Preserve the complete-bundle installation behavior, network-first dictionary/theme refresh, and cached fallbacks. Do not fix update problems by asking users to clear their progress or browser storage.

## Existing tests and their limits

`npm test` currently runs seven tests in two files:

- `tests/core.test.js` has five tests covering review intervals and the year boundary, duplicate additions, the repeat-again queue, storage roundtrips and malformed JSON, rejection of foreign backup IDs, and backup preservation of dictionary position and review dates.
- `tests/version.test.js` has two tests covering synchronization of manifests/UI/assets/cache, preservation of unrelated content and dependency versions, idempotence, and rejection of invalid versions or missing markers without changing the input objects.

The browser smoke test is **not** included in `npm test`. It starts its own HTTP server on a free localhost port and launches an installed Chromium browser headlessly with a temporary profile; a separately running development server is unnecessary. It looks for `BROWSER`, then the configured Windows Chrome and Edge executable paths. Set `BROWSER` to an existing executable if auto-detection fails, for example in PowerShell:

```powershell
$env:BROWSER = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
python tests/browser-smoke.py
```

It checks card content/forms, theme persistence, navigation, progress, catalog/search/filter behavior, dropdown toggling, empty results, focus/scroll restoration, layouts at 320 and 760 pixels, service worker assets, stale dictionary refresh, and dictionary/theme fallback when the server returns an error. Success prints `PASS`; assertion failures and timeouts return a nonzero exit status.

Important limits:

- UI interactions use DOM `.click()` calls, which can activate hidden controls. Passing this test does not prove every control is reachable by mouse, touch, or keyboard. For UI changes, inspect the affected interaction and visibility as well.
- The offline scenario simulates unavailable dictionary/theme endpoints, not a complete loss of network connectivity.
- The smoke suite is a single sequential scenario: an early failure prevents later assertions from running.
- Use the isolated test profile or `?demo=1` mode when exploring changes; do not alter the user's normal progress to test behavior.

For manual date checks, use `http://localhost:8000/?demo=1&day=1` or `?demo=1&day=7`. This mode uses separate tab session storage. Change the URL parameter in the same tab to advance the simulated day.

## Verification workflow

1. Read the affected code and inspect `git status`/`git diff` before editing. Preserve existing work and keep the diff limited to the task.
2. Implement the change and update relevant documentation. Add or adjust tests for changed behavior and meaningful regressions; documentation or formatting alone does not require new tests.
3. Format changed supported files. Use the local Prettier CLI for a focused change, for example `node node_modules/prettier/bin/prettier.cjs --write AGENTS.md`, or `npm run format` when formatting the whole repository is intended.
4. Choose checks according to the change:

| Change                                                  | Checks                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Documentation only                                      | `npm run format:check`, `git diff --check`                                                             |
| Progress, scheduling, or backup logic                   | `npm test`; browser smoke test if affected behavior is exposed through the UI                          |
| Dictionary, themes, or media                            | `npm run check`, `npm test`; browser smoke test when catalog behavior or its fixtures are affected     |
| HTML, CSS, app/theme JavaScript, PWA, or service worker | `npm test`, `npm run check`, `npm run version:check`, browser smoke test; inspect affected UI behavior |
| Version tooling or release version                      | `npm test`, `npm run version:check`; browser smoke test when runtime versioned files change            |
| Formatting/tool configuration                           | `npm run format:check`; `npm test` and browser smoke test if runtime code/templates are reformatted    |

5. For source changes, finish with `npm run format:check` and `git diff --check`. Run `npm run version:check` whenever versioned assets are touched. Repeat checks only after relevant changes or failures.
6. Treat unavailable tools or sandbox restrictions as a blocked check, not a passing test. Use the environment's permission mechanism when necessary; do not disable security protections. Report the exact unrun check and reason.
7. Summarize the change and actual verification results. Distinguish automated assertions from manual UI inspection. Do not claim all checks passed if any required check was skipped.

Commit, push, publish, and repository-setting changes only when they are part of the user's request. GitHub About is repository metadata and is not populated from README automatically.
