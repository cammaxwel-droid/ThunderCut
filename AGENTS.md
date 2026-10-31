# Thunder Cut: preserve Cam's game

Cam owns the design and makes all decisions about changes. This repository contains the finalized ThunderCut 1.1.3 Windows source, derived from the preserved 1.1.2 baseline. Preparing it for code review does not authorise redesign or gameplay changes.

- Start a review read-only. Describe concrete display problems and the smallest proposed correction. Do not apply fixes unless Cam requests them.
- Preserve the current artwork, sounds, layout, animation, timing, rules, probabilities, payouts, features, controls and save behaviour outside the exact requested change.
- Work on one requested change in a branch. Review the diff and test affected behaviour before asking Cam to review. Passing tests is not Cam's visual acceptance.
- Run `pnpm dev` for development. It uses an isolated save location under `.build/development-appdata`. Do not launch Electron directly against `desktop-app` for normal development; that bypasses this isolation.
- Never install a candidate over Cam's current game, use his personal saved data, change desktop shortcuts, update another game, or delete backups without his explicit instruction.
- Cam's final 1.1.3 decision is full motion only. Do not add a reduced-motion option or restore OS-dependent reduced-motion branches without a new explicit instruction. Test with Windows reduced motion both on and off; expect identical full animations. Preserve the approved full-motion timing.
- Keep builds, installers, personal data and credentials out of Git. Do not change repository visibility, publish releases or upload installers without Cam's instruction.
- Run `pnpm verify:baseline` to compare protected files with the imported baseline. A proposed authorised game edit will make this check fail until its differences are reviewed. Never update the manifest just to hide a change.
- This is a Windows source project. Website work, other platforms, auto-updates and distribution/sales changes are separate work.

The installed game and local recovery checkpoint are outside this repository. Build and clean commands must stay inside this checkout.
