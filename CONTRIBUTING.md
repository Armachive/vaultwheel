# Contributing

VaultWheel moves, renames, copies and trashes files in people's vaults, so file safety comes before everything else here.

## File safety first

- Nothing is lost. A change never overwrites a file without a copy in `.trash`, a copy is made under a hidden name and renamed when it is whole, and a step that fails leaves the original as it was.
- Moves and renames go through Obsidian (`fileManager.renameFile`), so links are kept.
- Hidden folders such as `.obsidian` stay out of reach, and no name can hide a file or leave its folder (`badName` in `plugin/main.js`).
- A new request from the page that writes to disk goes in `CHANGES` in `plugin/main.js`, with tests in `tests/plugintest.js` for what happens when it fails halfway.

## Build

You need `sh`, `perl`, `gzip` and `base64`, which any Linux has.

```sh
sh tools/release.sh                      # build/release/: main.js, manifest.json, styles.css, what the store installs
sh tools/build.sh bridge page.html public   # the page alone
```

To try a build, copy the three files from `build/release/` into `.obsidian/plugins/vaultwheel/` in a test vault, not one you care about.

## Test

You need Docker. The test browser is built the first time, from `tools/test-image/`. Tests use the made-up vault in `tests/fixture/`, so they need no personal files and no network.

```sh
sh tools/runall.sh                       # everything, with a summary at the end and the full list in build/runall.out
sh tools/runall.sh plugintest loadtest   # only these
```

Each browser runs in a one-shot container and starts only when the machine has room, so a full run on a small machine is slow. That is on purpose: leave `BOX_ROOM_MB` and `BOX_SLOTS` alone.

## What a change must pass

- `sh tools/runall.sh` ends with every line `PASS` and exit code 0.
- `sh tools/release.sh` finishes. It stops on what a store build must not hold.
- New behaviour has a test, and that test fails without the change.
- What tests cannot see (layouts, sidebars, the mobile view) is looked at in real Obsidian, and you say what you could not check.
- Nothing personal in a tracked file: no real names, paths, vault names or file names.
- No network calls of its own, and no visible change you do not mean.
- `vendor/` stays as its upstream has it, see `vendor/NOTICE.md`. Our own CSS and code work around it.
