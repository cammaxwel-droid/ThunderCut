# Contributing

Discuss substantial changes in an issue before implementing them. For an
ordinary bug fix, open a branch and keep the patch focused on that problem.
Cam decides what enters the official game; passing tests is not visual approval.

Preserve the established artwork, audio, animation timing, controls, game maths,
RNG, payouts, feature routing and saved-state behaviour outside the requested
change. Do not bundle dependency upgrades or unrelated cleanup with a display fix.

Use the isolated `pnpm dev` launcher and run `pnpm typecheck`, `pnpm test` and
`pnpm build`. Describe the trigger, before/after behaviour, checks performed
and anything untested. Add meaningful regression coverage for a logic change;
include screenshots for a visible change. Never commit personal saves, test
profiles, secrets, installers or generated renderer output.

Code contributions must be compatible with the MIT licence. Do not submit new
media or third-party content without explaining its origin and rights. The
existing assets and branding remain governed by ASSET_LICENSE.md.

See SECURITY.md for sensitive vulnerability reports. Use ordinary issues for
non-sensitive bugs. Release publication and official canon decisions remain
with the maintainer; automated tools must not publish or merge without instruction.
