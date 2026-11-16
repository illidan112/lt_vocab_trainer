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

Run `node --test tests/*.test.js` to execute the tests (Node.js 20+). Run `node scripts/check-assets.js` to validate the dictionary and files before publishing. No dependencies need to be installed.

### Testing dates

Open `http://localhost:8000/?demo=1&day=1` to simulate tomorrow, or use `?demo=1&day=7` to simulate a week from today. This mode uses separate, temporary storage for the tab and leaves your regular progress unchanged. To switch dates within the same tab, change the URL parameter. This also works on a test deployment.

