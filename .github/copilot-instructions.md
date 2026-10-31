# ThunderCut repository instructions

Follow AGENTS.md. This is the official Windows source for ThunderCut 1.1.3,
a demo-credit game by Cameron Maxwell M / Native. Preserve Cam's established
game and stay within the requested change. A code review is read-only unless
implementation is requested; do not turn observations into unsolicited fixes.

Keep visual changes separate from game rules, probabilities, RNG draw order,
payouts, feature triggers, settlement and saved-state logic. Do not reskin assets,
replace sounds or change animation timing as incidental cleanup. Full motion is
the approved behaviour under both Windows motion settings. No reduced-motion
selector or OS-dependent motion branch should be added without instruction.

Use `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`
and the isolated `pnpm dev` launcher. Never use personal production saves for
tests or launch `electron desktop-app` for normal development. Packaging commands
create files under release/; they do not authorize installation or publishing.

Read docs/TESTING.md before interpreting the old baseline verifier or lint.
The imported 1.1.2 hash manifest intentionally differs at four approved files;
never regenerate it to hide a change. Keep dependency versions pinned unless
an upgrade is explicitly in scope. Use meaningful tests and report actual
results, including failures and untested paths. Check visual changes in windowed
and full-screen modes; automated tests do not establish Cam's visual approval.

Original code and technical documentation use MIT. Creative media, image fonts,
icons and branding retain separate rights under ASSET_LICENSE.md. Do not copy
those assets into other projects or treat their availability as MIT permission.
Keep personal data, credentials, test output, installers and generated renderer
files out of Git. Do not auto-merge, publish a release or change game canon.
