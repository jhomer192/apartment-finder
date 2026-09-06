/**
 * Syndicated listings often carry an unsubscribe or opt-out mailbox where a
 * leasing address should be; writing to one reaches nobody.
 */
const NON_CONTACT_MAILBOX = /^(stop|start|help|unsubscribe|no-?reply|do-?not-?reply|postmaster|abuse|privacy)@/i;

export function leasingEmail(address: string | null | undefined): string | null {
  const trimmed = address?.trim();
  if (!trimmed || NON_CONTACT_MAILBOX.test(trimmed)) return null;
  return trimmed;
}
