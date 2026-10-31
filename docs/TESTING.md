# Verification and safe development

For ordinary source changes, run `pnpm typecheck`, `pnpm test` and `pnpm build`.
Windows CI runs the same checks and stages the package. A green check is evidence
for those checks only, not a security audit, RTP certification or visual approval.

`pnpm dev` keeps its saves under `.build/development-appdata`. Packaged executables
normally use production saves. Do not point tests at your installed game's
profile or install a candidate over a known-good copy without deciding to do so.

## Baseline and lint

`BASELINE_MANIFEST.json` is the original 1.1.2 import manifest. It is retained as
historical evidence, not rewritten to match the final release. Running
`pnpm verify:baseline` against 1.1.3 reports four approved differences:

- `app/page.tsx`: approved presentation and final credits
- `app/globals.css`: approved presentation and full-motion-only behaviour
- `desktop-app/main.cjs`: Windows ICO selection
- `desktop-app/package.json`: final version and credits

151 of its 155 entries still match. New files and packaging configuration are
outside that historical manifest's coverage. Review diffs separately.

`pnpm lint` has three existing errors and six warnings in unchanged effect and
cleanup logic in `app/page.tsx`. They are not represented as passing or silently
suppressed. Lint is not currently a required CI gate. Do not fix unrelated game
logic as part of a graphics review.

## Release checks

The final 1.1.3 game passed 18 existing tests, typecheck, native renderer checks
with both Windows motion preferences, exact credit/debit settlement fixtures,
all-payline presentation checks and icon/payload verification. The public
packaging adds licence/notices without editing game logic or media; its payload
is compared with that approved package.

Fresh-PC installation, upgrade and uninstall remain untested. There is no new
RTP measurement, endurance claim or comprehensive security assessment.
