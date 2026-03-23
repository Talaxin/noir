# Noir Module Release Guide (Agents)

Use this checklist every time module files are changed.

## Scope
- Module files live in:
  - `NoirServices/Miruro/`
  - `NoirServices/AnimeKai/`
  - `NoirServices/TokyoInsider/`
- Module version values are in:
  - `NoirServices/Miruro/miruro.json`
  - `NoirServices/AnimeKai/animekai.json`
  - `NoirServices/TokyoInsider/tokyoinsider.json`

## Version rule
- Always bump module versions by `+0.0.1` for a module update.
- Keep module `scriptUrl` pointing to:
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/...`

## Verify current versions quickly
- Read module JSON files and check each `"version"` field.
- Confirm remote is:
  - `https://github.com/Talaxin/Noir.git`

## Release steps (modules-only)
1. Edit module code (`.js`) as needed.
2. Bump `"version"` in each module JSON being released.
3. Run:
   - `git status --short`
   - ensure changed files are expected module files.
4. Commit:
   - include module `.js` and updated module `.json` files.
5. Push to `origin main`.

## Optional remote verification
- Check raw JSON links after push:
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/Miruro/miruro.json`
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/AnimeKai/animekai.json`
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/TokyoInsider/tokyoinsider.json`

## Notes
- Do not change git remotes away from `Talaxin/Noir`.
- Do not include unrelated local files (`.DS_Store`, derived build artifacts) in commits.
