# ThunderCut 1.1.6

Windows x64 update for Cam the Mower Man Thunder Cut. Play with free demo credits.

## Updates

- Space respects focused controls, including Gamble buttons, and the action hint reflects when a win can be collected or gambled.
- The demo reset shortcut respects modifier keys and protects a pending win.
- The Classic Cut Free Games screen gives clearer instructions. Coin Storm shows the current count and whether the coins landed, queued or are held.
- Major and Grand jackpot entry requirements stay visible in compact layouts. Game Info, Sound and Fullscreen remain readable above the artwork.
- The development and build dependencies include the reviewed security fixes. The repository uses the pnpm lockfile for reproducible builds.

## Download

Get `Thunder-Cut-Setup-1.1.6-x64.exe` and `SHA256SUMS.txt` from the
[GitHub release](https://github.com/cammaxwel-droid/ThunderCut/releases/tag/v1.1.6).
The installer includes Electron 44.10.1 and is unsigned.

Installer SHA-256

    24be36898277cf4d9c909df42d4ea232d5820100301dae2cc01d109409c646a3

## Verification

Cam approved the combined review candidate after playing it. All 132 renderer files match that candidate byte for byte. All 215 files extracted from the installer match the built package. The application version is the only change inside the game archive relative to the approved candidate.

TypeScript and all 18 existing tests passed. Running the extracted executable with a separate demo profile verified mouse and Space spins, single debits, collection of a win, native fullscreen and Escape, full reel animation under both emulated motion preferences, and save recovery after restart.

Installer verification covered extraction and running the packaged application. Fresh-machine installation, upgrade and uninstall were outside this verification.
