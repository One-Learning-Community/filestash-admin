# Filestash admin console

A replacement admin console for [Filestash](https://github.com/mickael-kerjean/filestash), installed as a plugin on an unmodified server: the official Docker image or binary, no rebuild.

- A real Save button: edits are kept until you save or discard, and leaving with unsaved changes asks first.
- Authentication on its own page, with users of the "Local users" login method managed there.
- Storage, workflows, activity and audit logs, and settings split into sections, each with its own address.
- Feature switches, Google Drive and Dropbox app keys, secret key checks, and notes on settings that need a restart or that an environment variable overrides.
- A System page: the server's health check, configuration backup and restore, and the web console.
- Translatable.

It uses the same admin API as the built-in console and changes nothing outside `/admin`.

## Install

1. Download `admin_svelte.zip` from [Releases](../../releases), or build it (below).
2. Copy it into `data/state/plugins/` on your Filestash server. In the official Docker image that's `/app/data/state/plugins/`, inside the data volume. Keep the file name: the plugin finds its files by it.
3. Restart Filestash. `/admin` now runs this console.

To uninstall, delete the zip and restart. The built-in admin comes back.

In Docker, put the zip inside the data volume you already mount. Don't bind-mount the zip on its own: the image refuses to start when anything under `/app` isn't owned by its `filestash` user.

## How it works

Filestash loads zip plugins from `data/state/plugins/` at startup, and a plugin can patch the server's static files as they are served. This one patches `public/assets/boot/ctrl_boot_backoffice.js`, the first script the admin page loads, to put `plugin/takeover.js` at its top. The takeover removes the built-in admin's styles and widgets, loads this console from the zip, and never lets the built-in admin start. The file browser is untouched.

The patch only depends on that file's first three lines, which haven't changed since August 2024. If Filestash changes them, the patch stops applying and the server serves its built-in admin instead, so the worst case is falling back. Rebuild the plugin against the new Filestash to fix it. One exception: a server started with `DEBUG=true` exits when a patch fails to apply.

## Develop

Requires Node 22 or later. Run these from the repo root.

- `npm ci`: install.
- `npm run dev`: dev server on http://localhost:5173. It proxies API calls to a Filestash server on port 8334, so start one first.
- `npm test`: unit tests (Vitest).
- `npm run check`: type-check (svelte-check and tsc).
- `npm run build`: build the console into `build/`.
- `npm run plugin`: build, then package `dist/admin_svelte.zip`.
- `npm run i18n`: rebuild the English language files from the source (see Translations).

The plugin's patch is made from Filestash's copy of the boot file. By default it's read from GitHub at `master`. Set `UPSTREAM` to build against another branch, tag or commit, and `FILESTASH_REPO` to read it from a local checkout instead:

```sh
UPSTREAM=6feaa212 FILESTASH_REPO=../filestash npm run plugin
```

Pushing a tag that starts with `v` builds the plugin and attaches it to a GitHub release (`.github/workflows/release.yml`).

## Translations

Language files live in `locales/` and use the main Filestash app's format: a flat JSON object whose keys are the English text upper-cased with `_` for spaces (`"DELETE_STORAGE": "Delete storage"`), and `{{VALUE}}` or `{{NAME}}` where a value is inserted.

- `en.json` holds every key with its English text and is built into the bundle.
- `_.json` is the blank template. To add a language, copy it to `<code>.json` (for example `fr.json` or `pt-BR.json`) and fill in the values. Empty values fall back to English.
- At startup the console fetches the browser language's file (`fr-CA.json`, then `fr.json`). If there is none it stays in English.

In the source, fixed text goes through `t("Some text")` from `$lib/i18n`. The argument must be a string literal, because `npm run i18n` reads those literals to rebuild `en.json` and `_.json`. A test fails when the two files are out of date. Run it after adding or changing text.

Names that come from the server (storage types, login methods, form fields, dropdown options, settings sections) use dotted keys: `STORAGE.S3`, `LOGIN_METHOD.LOCAL`, `FIELD.ACCESS_KEY_ID`, `OPTION.GRID`, `SECTION.GENERAL`. A text key never contains a dot, so the two can't collide. Name keys are written by hand in `en.json` (the script keeps them). A name with no entry is shown with the old admin's rule: `access_key_id` becomes "Access Key Id".

Help text under form fields comes from the server plugins as HTML and is not translated here.

## License

[AGPL-3.0](LICENSE), like Filestash. Copyright © 2026 Dan Krieger.

This project is not affiliated with Filestash or its authors.
