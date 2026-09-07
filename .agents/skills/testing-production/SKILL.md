---
name: apartment-finder-production-testing
description: Verify deployed Apartment Finder account flows through the browser without a local server or outgoing owner messages.
---

# Production account testing

Use the production origin and requested account supplied in the handoff. Do not start a local development server when verifying a VPS deployment.

## Devin Secrets Needed

- Authorized VPS SSH private key (the production handoff supplies its path).
- No inbox/password is required when invite minting is explicitly authorized.

## Authentication

Mint a single-use invite through the deployed `server/scripts/invite.ts` command as the service user with the deployed Node runtime. Prefer the project's environment loader over sourcing `.env` as shell: display-name values such as `MAIL_FROM` may not be shell-safe. If the CLI prints a localhost invite URL, replace only the origin with the supplied production origin. Redeem in the browser and visibly confirm the exact requested email in the header. Avoid repeated email-link requests because that endpoint is rate-limited.

## Runtime flow

- Allow Claude-backed actions at least 60 seconds before diagnosing a timeout.
- For conversational search, use renter-language prompts followed by a reference to a prior pick; verify both preserved criteria and arithmetic. Use Start over between independent scenarios. Check that roommate income, occupancy rules, and scam conclusions are not invented or stated more strongly than the available evidence.
- Verify real-photo and explicit missing-photo cards separately; do not manufacture broken source data.
- For galleries, sample both sources with next/previous and wrap-around, and traverse every frame of one gallery per source. Source metadata photo counts may exceed the rendered gallery cap; report this distinction rather than claiming every source photo is accessible. Check rendered images, not counters alone.
- When password setup is explicitly authorized, set it only within the requested authenticated account. Keep the temporary credential private (for example in a mode-0600 file), never print it or include it in evidence. Test one wrong and one valid login rather than exhausting the rate limit, and leave email-link fallback available without submitting extra requests.
- Expand both a zero-risk and positive-risk badge. Check the highest-risk sort.
- Test saved listing status and notes across reload.
- Generate drafts without activating Email, Call, or other owner-contact actions.
- For contact sanitization fixes, reuse an existing saved listing: shortlist snapshots can retain source data from before deployment.
- Save distinct personal alert values and verify every value after reload; Discord is intentionally disabled when no webhook is configured.
- After sign-out, reload the production root and confirm the invite-only gate replaces account data.

When a new deployment changes behavior mid-run, stop recording and retest the affected flow on the new deployment; retain unaffected coverage but do not present older recordings as current.
