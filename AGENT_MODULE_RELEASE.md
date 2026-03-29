# Noir Build + Module Release Guide (Agents)

Use this exact runbook when releasing Noir from:
`/Users/talaxin/Documents/cursor_projs/Noir`

## Hard Rules
- Single source of truth is the `Noir` directory above.
- Git remote must be only: `https://github.com/Talaxin/Noir.git`
- Keep local files; do not delete unrelated local content.
- Push only intended release artifacts and module files.

### Only bump what you change (non-negotiable)
- **Do not** bump `version` in a module manifest unless that module’s **`.json` or `.js`** changed in this release.
- **Do not** bump `MARKETING_VERSION`, `repo.json`, or `build/Noir.ipa` unless you are shipping a **new app build** for eSign.
- **New module:** add manifest + script with **`version": "1.0.0"`** and commit **only** those files (and any wiring you actually changed). Leave other modules, the Xcode marketing version, `repo.json`, and the IPA **unchanged** unless the user explicitly asked for an app release.
- `release_esign.py --bump` increments **every path you pass to `--modules`**. Prefer **`--modules` with only the manifests that changed** instead of relying on defaults when the release is selective.

## Files That Matter
- App project/version:
  - `Noir.xcodeproj/project.pbxproj`
- eSign/AltStore metadata:
  - `repo.json`
  - `release_esign.py`
- IPA build script:
  - `ipabuild.sh`
- Module manifests/scripts:
  - `NoirServices/Miruro/miruro.json`
  - `NoirServices/Miruro/miruro.js`
  - `NoirServices/AnimeKai/animekai.json`
  - `NoirServices/AnimeKai/animekai.js`
  - `NoirServices/TokyoInsider/tokyoinsider.json`
  - `NoirServices/TokyoInsider/tokyoinsider.js`
  - `NoirServices/HiMovies/himovies.json`
  - `NoirServices/HiMovies/himovies.js`

## Preflight Checks
1. Confirm location:
   - `pwd` must be `/Users/talaxin/Documents/cursor_projs/Noir`
2. Confirm remote:
   - `git remote -v` must show `Talaxin/Noir.git` for fetch and push.
3. Confirm no merge conflicts:
   - Search for `<<<<<<<`, `=======`, `>>>>>>>` and resolve if found.
4. Validate parsable metadata:
   - JSON and plist files must parse/lint cleanly.

## Version bump rule (app + eSign)
- When you **are** shipping a new IPA: increment **`MARKETING_VERSION`** by **`+0.0.1`** (patch), rebuild the IPA, then align **`repo.json`** with that same version (via `release_esign.py` or careful manual edit). Example: `1.0.23 -> 1.0.24`.
- **IPA must match `repo.json`:** `MARKETING_VERSION` becomes `CFBundleShortVersionString` inside the IPA. If you only bump `repo.json` and not the Xcode project, eSign will show a new version but the installed app will still report the old one.
- Module manifest bumps are **independent**: only bump a module’s `version` when that module’s files changed; use **`release_esign.py --bump --modules ...`** to list **only** those JSON paths.

## Build IPA
1. Run:
   - `bash ./ipabuild.sh ios`
2. Expected output IPA:
   - `build/Noir.ipa`
3. Quick sanity:
   - file exists and has non-zero size.

## Update repo.json (and optional module bumps)
After a **new** IPA exists, refresh metadata. For a **full** app release you typically bump app version and only the module manifests you edited:

```bash
python3 ./release_esign.py --bump \
  --modules NoirServices/Miruro/miruro.json \
  --description "Describe the release briefly."
```

Pass multiple `--modules` paths only for manifests that actually changed. Omit `--modules` only when you intend the script default list (see `release_esign.py`).

What `--bump` updates:
- `repo.json` app `version` / `versionDate` / `versionDescription` / `size`
- `repo.json` latest `versions[0]` (same fields + `size`)
- Each module JSON listed in `--modules`: `version` **+0.0.1**

**Module-only drop (no new app):** do **not** run `--bump`. Commit the new or updated `NoirServices/...` files only.

## Validate Before Push
1. Build check:
   - `xcodebuild -project Noir.xcodeproj -scheme Noir -configuration Debug -destination "generic/platform=iOS" -quiet build`
2. Release check:
   - `xcodebuild -project Noir.xcodeproj -scheme Noir -configuration Release -destination "generic/platform=iOS" -quiet build`
3. If you shipped an IPA: confirm `repo.json` version equals IPA `CFBundleShortVersionString`.
4. Confirm module `scriptUrl` values point to:
   - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/...`
5. Confirm intended changed files via:
   - `git status --short`

## Commit and Push
1. Stage only intended files (modules, `repo.json`, build artifact(s), related source changes).
2. Commit with clear release message.
3. Push to `origin main`.

## Post-Push Links To Verify
- Repo metadata:
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/repo.json`
- IPA:
  - `https://github.com/Talaxin/Noir/raw/main/build/Noir.ipa`
- Module manifests:
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/Miruro/miruro.json`
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/AnimeKai/animekai.json`
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/TokyoInsider/tokyoinsider.json`
  - `https://raw.githubusercontent.com/Talaxin/Noir/main/NoirServices/HiMovies/himovies.json`

## Agent Hand-off Notes
- If release metadata and IPA version ever mismatch, rebuild IPA and rerun `release_esign.py` (with correct `--modules` scope).
- Do not switch to other repositories.
- If a command needs elevated permissions, ask user once and then continue with sudo as approved.
