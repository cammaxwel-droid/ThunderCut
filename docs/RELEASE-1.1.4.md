# ThunderCut 1.1.4

Windows x64 patch release. Free to download and play with demo credits; no cash value.

## Download

Download `Thunder-Cut-Setup-1.1.4-x64.exe` and `SHA256SUMS.txt` from the
[v1.1.4 release](https://github.com/cammaxwel-droid/ThunderCut/releases/tag/v1.1.4).
The installer includes the runtime and licence notices. It is unsigned.

## Fixes

- When the selected bet exceeds the available credits, affordable-bet guidance
  keeps the game in place while focusing the bet control.
- Paid spin requests below the $1 minimum bet are ignored while automatic
  session ending completes. They no longer display misleading bet guidance.
- Available free games remain playable at zero credits. Affordable paid spins
  retain their existing debit and settlement behaviour.

Artwork, sound, full-motion timing, probabilities, payouts, feature rules and
saved-state handling are unchanged.

## Verification

Cam accepted the isolated review candidate after hands-on play. Focused native
runtime testing passed 60 qualifying session-ending transitions: losing Gamble
and final free game at $0 and $0.99, each using mouse, repeated Space and held
Space, with five qualifying repetitions per combination. Three natural outcomes
that did not qualify for session ending were retained separately.

Four supporting checks passed: affordable-bet guidance with mouse and Space,
a free game starting at zero credits, and a single affordable paid spin. The
two supporting spin samples awarded $0; they did not newly exercise collecting
a positive award. The $0.99 cases used isolated boundary fixtures. No production
RNG, effects or timing was overridden.

The final release's build, installer digest and package verification are recorded
in the GitHub release notes and checksum asset. Fresh-PC installation, upgrade
and uninstall remain unverified. This is not an exhaustive gameplay, security,
endurance or RTP assessment. See [TESTING.md](TESTING.md) for historical baseline
and lint limits.

Original code uses MIT. Artwork, audio and branding retain separate rights;
see ASSET_LICENSE.md and THIRD_PARTY_NOTICES.md.
