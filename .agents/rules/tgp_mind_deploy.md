# TGP Mind Auto-Deploy Rule

When you make code changes, bug fixes, or enhancements to the `tgp-mind` project (Cloud Run backend), you MUST proactively build and deploy those changes automatically, unless the user explicitly asks you not to.

To do this, use the `run_command` tool with the following parameters:
- **Cwd**: `c:\Users\ygnat\tgp-hemeroteca\tgp-mind`
- **CommandLine**: `npm run build; powershell -ExecutionPolicy Bypass -File deploy.ps1`
- **BypassSandbox**: `true`

Execute this automatically as part of your turn after completing the code modifications so the user does not have to do it manually.
