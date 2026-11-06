# ThunderCut

**[⚡ Get ThunderCut for Windows](https://thundercut-download.cammaxwel.chatgpt.site/)**

[Direct installer download](https://github.com/cammaxwel-droid/ThunderCut/releases/download/v1.1.6/Thunder-Cut-Setup-1.1.6-x64.exe)
 · [SHA-256 checksum](https://github.com/cammaxwel-droid/ThunderCut/releases/download/v1.1.6/SHA256SUMS.txt)

**Cam The Mower Man — A Game by Native.**

A free Windows slot-style game with original artwork and sound, full-motion
reels, free games and the Coin Storm feature. The game uses demo credits with
no cash value.

[Release notes](docs/RELEASE-1.1.6.md)
 · [Report a bug](https://github.com/cammaxwel-droid/ThunderCut/issues/new/choose)

## Play on Windows

1. Open **Get ThunderCut for Windows** above and choose **Download for Windows**.
2. Run the installer and choose an installation folder.
3. Launch **ThunderCut** from the desktop or Start menu shortcut.

This package targets Windows x64. It includes its runtime; players do not need
Node.js, pnpm, VS Code or a separate browser. GitHub's **Source code ZIP** is
for development and is not an installer.

The installer is unsigned, so Windows may show an unknown-publisher warning.
Obtain it from this repository's release page and compare its SHA-256 with the
provided `SHA256SUMS.txt`. Fresh-machine installation, upgrade and uninstall
have not yet been verified. See the release notes for the checks performed.

Use the on-screen controls or **Space** to spin when available. **Game info**
contains the paytable, feature explanations and session controls. Animations
use the game's approved full-motion timing, independent of the Windows motion
preference. The current release is **1.1.6**.

## Develop and review

Use Windows x64, Node.js **24 LTS** and **pnpm 11.25.0**:

```powershell
git clone https://github.com/cammaxwel-droid/ThunderCut.git
cd ThunderCut
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm dev
```

`pnpm dev` uses separate development saves under `.build/development-appdata`.
Do not launch `electron desktop-app` directly for development: that bypasses
save isolation. Preserve personal saves and installed copies when testing.

```powershell
pnpm build                 # Build the Windows renderer
pnpm desktop:unpacked      # Create release/win-unpacked/ThunderCut.exe
pnpm desktop:package       # Create the Windows installer under release/
```

Packaging does not install the game or change shortcuts. The first build needs
network access for dependencies and packaging tools. Versions remain pinned
in `pnpm-lock.yaml`; inherited web-tool dependencies are retained without
introducing a website or hosted service. The root package's `0.1.0` is inherited
tool metadata; `desktop-app/package.json` owns the game version.

Read [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md) and
[the testing notes](docs/TESTING.md) before changes. Copilot has repository
instructions in `.github/copilot-instructions.md`. Work in a branch and keep
visual corrections separate from maths, payouts, sound and feature changes.

| Area | Location |
| --- | --- |
| Main game and features | `app/page.tsx` |
| Presentation and paylines | `app/globals.css`, `app/PaylineTrace.tsx` |
| Game rules and settlement | `app/gameRules.ts`, `app/coinRules.ts`, `app/settlementRules.ts`, `app/sequence.ts` |
| Audio and media | `app/audio.ts`, `public/` |
| Windows host and saved-state handling | `desktop-app/` |
| Development and packaging | `desktop/`, `electron-builder.yml` |

## Licences

**Code: MIT. Artwork, audio and branding: rights reserved.**

The [MIT licence](LICENSE) covers the original source code and technical
documentation. The [asset licence](ASSET_LICENSE.md) permits free play and local
personal development but does not release the creative media or branding under
MIT. Dependencies retain their own licences; see
[third-party notices](THIRD_PARTY_NOTICES.md).

## Credits

ThunderCut - Cam The Mower Man - SS - SCATTEREDBRAIN SLOTS - native.games - Cameron Maxwell M - A Game by Native.
