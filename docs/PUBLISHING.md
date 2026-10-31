# Windows release procedure

1. Start from an approved commit and a clean working tree. Keep the previous
   approved package and personal saved data safe.
2. Run the checks in TESTING.md. Build with `pnpm desktop:package`, or manually
   run the **Build Windows installer** workflow. Workflow artifacts are review
   candidates; the workflow never publishes a release automatically.
3. Check the built executable, canonical ICO, licence files, save isolation,
   actual installed behaviour and affected presentation. Record any untested
   paths. Do not describe an unsigned package as signed.
4. Calculate SHA-256 for the exact installer being shared. Create a versioned
   GitHub Release from the approved source commit and attach the installer and
   `SHA256SUMS.txt`, with honest notes about verification and known limits.
5. Verify the uploaded asset digest. Share the release link. Keep generated
   installers and profiles out of source control.

Code uses MIT. Assets and branding do not; distribute the official game with
its asset terms and third-party notices intact. There is no website, updater,
signing key or paid distribution integration configured by these workflows.
