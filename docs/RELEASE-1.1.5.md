# ThunderCut 1.1.5

Windows x64 maintenance release. Free to download and play with demo credits;
no cash value.

## Download

Download Thunder-Cut-Setup-1.1.5-x64.exe and SHA256SUMS.txt from the
[v1.1.5 release](https://github.com/cammaxwel-droid/ThunderCut/releases/tag/v1.1.5).
The installer includes its runtime and licence notices. It is unsigned.

Installer SHA-256:

    f2a30a85d835c08d060c15a781da6e11269732849163b0464d744a5ca2428f8c

## Updates

- Updates the packaged Electron runtime from 44.0.0 to 44.10.1. The dependency,
  lockfile and installer runtime pin agree on the version.
- Includes the accepted Next.js 16.4.1 update in the development/build graph.
- Resolves the ten reviewed critical Next.js alerts and eight reviewed Electron
  alerts on the repository's default branch.

All fixes from v1.1.4 remain included. Artwork, sound, layout, full-motion
timing, probabilities, payouts, feature rules, controls and save handling are
unchanged.

## Verification

Cam accepted the isolated v1.1.5 candidate after hands-on play. Typecheck and
18 existing tests passed. All 215 extracted installer payload files matched the
built package. All 132 renderer files matched shipped v1.1.4 byte-for-byte;
inside the 139-file game archive only the application version metadata changed.

The exact packaged executable reported application version 1.1.5 and Electron
44.10.1 with hardware acceleration and renderer isolation enabled. Bounded
isolated tests passed mouse and Space paid spins, single debits, positive-win
collection, fullscreen/native Escape, full animation and saved-state recovery
after restart. Two natural spins were exercised; the Space spin awarded zero,
so positive-win collection for that input was not observed. RNG was unchanged.

Both emulated reduced-motion media preferences retained the full reel animation.
Windows accessibility settings were not changed. The historical baseline still
reports the same five differing paths as before preparation; its manifest was
preserved. See [TESTING.md](TESTING.md) for historical testing and lint limits.

The installer was verified by extraction and its packaged application was run
with separate synthetic profiles. Fresh-machine installation, upgrade and
uninstall remain unverified. This is not an exhaustive gameplay, security,
endurance or RTP assessment. The installed game and personal saves were not used.

Original code uses MIT. Artwork, audio and branding retain separate rights;
see ASSET_LICENSE.md and THIRD_PARTY_NOTICES.md.