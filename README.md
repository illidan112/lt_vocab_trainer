# Lithuanian Words

A static web app for learning Lithuanian vocabulary on mobile devices. Progress is stored in your browser and can be backed up as a JSON file.

## Word themes

Each entry in `data/words.json` has a required `theme` field identifying its primary theme. For example, `namas` has `"theme": "housing-home"`. The `data/themes.json` reference file contains 12 themes, each with a stable `id`, a Lithuanian name (`nameLt`), and a Russian translation (`nameRu`).

Themes are assigned based on a word's meaning and example sentence. General vocabulary, time, numbers, clothing, and function words belong to `daily-life` ("Daily life") unless the context suggests a more specific theme. New themes require prior agreement.

In the All words tab ("Все слова"), the Themes filter ("Темы") displays words from the selected themes and works alongside search. All themes are selected by default; clearing every checkbox leaves the list empty. Your selection is kept when switching between tabs and word cards until the page is reloaded. The filter works offline after the first load.

## Backups

The Backup button ("Резервная копия") lets you download your progress as JSON and restore it from a file. Browser storage can be cleared by you or the system, so save a backup regularly.

## Testing

### Running locally

Run `python3 -m http.server 8000` from the project directory, then open `http://localhost:8000`. On Windows, you can use `py -m http.server 8000`. A modern browser is required. Opening `index.html` via `file://` will not work: JSON loading and PWA features require a web server.

The app runs without installing any dependencies. For development, run `npm ci` to install the local formatting tool. Run `npm test` to execute the tests (Node.js 20.11+), and `npm run check` to validate the dictionary and files before publishing.

### Testing dates

Open `http://localhost:8000/?demo=1&day=1` to simulate tomorrow, or use `?demo=1&day=7` to simulate a week from today. This mode uses separate, temporary storage for the tab and leaves your regular progress unchanged. To switch dates within the same tab, change the URL parameter. This also works on a test deployment.

## Code style

Run `npm run format` to format the source files with Prettier, or `npm run format:check` to check formatting without modifying files. The configuration uses two-space indentation, single quotes in JavaScript, and LF line endings. Dictionary data in `data/` is excluded from automatic formatting. Prettier is a local development dependency and is not loaded by the app.

## Updating the version

Use `package.json` as the source of truth for the release version. Run one command to set a new version:

```sh
npm run version:set -- 0.1.12
```

This updates `package.json`, `package-lock.json`, the version shown in the app, the asset URLs in `index.html`, and the service worker cache and asset URLs. The command preserves Prettier formatting and does not create a Git commit or tag. Run `npm run version:check` to check that all version references are consistent.

## TODO

- [ ] **Improve the project overview.** Add a screenshot, a demo link, key features, and quick-start instructions near the beginning of this README. State that the app is intended for Russian-speaking learners.
- [ ] **Add GitHub Actions checks.** Run tests and dictionary validation on every push and pull request, with browser smoke checks as a separate step.
- [ ] **Preserve compatibility with older progress.** Add migration of the legacy `ačiū` and `nėra už ką` IDs in `js/core.js` so backups created before the cards were merged can still be imported.
- [ ] **Strengthen data validation.** Extend `scripts/check-assets.js` to validate required text fields and field types. Reject impossible calendar dates such as `2026-99-99` when validating progress.
- [ ] **Make browser tests reflect user interactions.** Check visibility and expand the theme dropdown before interacting with its checkboxes. Document the browser test command in this README and add a script for it to `package.json`.
- [ ] **Add a license and dictionary provenance.** Include a `LICENSE` file and document the dictionary sources and usage terms for both code and data.
