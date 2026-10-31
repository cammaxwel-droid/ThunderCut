# Security policy

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/cammaxwel-droid/ThunderCut/security/advisories/new).
Do not post credentials, personal saves or working exploit details in a public
issue. Include the release version, Windows version, affected path, reproduction
steps and likely impact. Use synthetic data where possible. Ordinary visual
bugs belong in Issues.

The current release is 1.1.3. Reports against it and the default branch are
welcome. There is no guaranteed response deadline or support promise for older
versions. This policy is not a security audit or a certification.

## System and trust boundaries

ThunderCut is a Windows Electron game using demo credits, not a real-money
payment service. Relevant components are `desktop-app/` (main process, preload,
custom protocols and persistence), `app/` (renderer), and the dependency/build
and release configuration. There is no server deployment in this repository.

Review untrusted protocol URLs, renderer-originated IPC, saved-state content,
asset paths and dependency/build inputs. A trusted local installation does not
make externally supplied inputs safe. Do not assume tests prove a boundary.

## Properties to preserve

- Renderer content must not gain unrestricted Node.js or operating-system access.
- IPC must validate the sender and input before reading or writing saved state.
- Protocol handling must not escape the intended renderer directory, navigate
  to arbitrary content, or dispatch unintended commands.
- Save recovery must not duplicate a committed transaction or overwrite unrelated files.
- Builds and releases must exclude credentials, personal data and test profiles.
- CI for pull requests must not expose secrets or grant untrusted code release authority.

Assess findings by demonstrated reachability and impact. Arbitrary code execution,
path escape, unintended file access, IPC bypass, sensitive-data exposure and
release compromise are reportable. No blanket exclusions or accepted-risk
waivers are established here. Gameplay balance and visual defects can be regular
bugs; a concrete security consequence still warrants security review.

## Release limitations

The Windows installer is currently unsigned. This is recorded as a distribution
limitation, not evidence that other vulnerabilities are acceptable. Public
source and dependency checks are not a substitute for independent security review.
