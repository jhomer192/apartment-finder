import { beforeEach, describe, expect, it } from 'vitest';
import { isAllowed, resolveSession, verifyPassword } from './auth.js';
import { db } from './db.js';
import {
  claimJoinLink,
  createJoinLink,
  listJoinLinks,
  listMembers,
  previewJoinLink,
  removeMember,
  revokeJoinLink,
} from './members.js';

const INVITER = 'test@example.com';
const FRIEND = 'friend@example.com';

beforeEach(() => {
  db.prepare('DELETE FROM join_links').run();
  db.prepare('DELETE FROM members').run();
  db.prepare('DELETE FROM passwords').run();
  db.prepare('DELETE FROM sessions').run();
});

describe('join links', () => {
  it('admits a stranger with the password they chose, once', () => {
    const { token } = createJoinLink(INVITER, 'Sam');
    expect(isAllowed(FRIEND)).toBe(false);
    expect(previewJoinLink(token)).toMatchObject({ invitedBy: INVITER });

    const result = claimJoinLink(token, 'Friend@Example.com', 'hunter22');
    expect(result?.email).toBe(FRIEND);
    expect(isAllowed(FRIEND)).toBe(true);
    expect(verifyPassword(FRIEND, 'hunter22')).toBe(true);
    expect(resolveSession(result?.sessionToken)?.email).toBe(FRIEND);

    expect(previewJoinLink(token)).toBeNull();
    expect(claimJoinLink(token, 'another@example.com', 'hunter22')).toBeNull();
    expect(isAllowed('another@example.com')).toBe(false);
  });

  it('rejects unknown, revoked and expired tokens', () => {
    expect(claimJoinLink('not-a-real-token-at-all', FRIEND, 'hunter22')).toBeNull();

    const { token, link } = createJoinLink(INVITER, '');
    expect(revokeJoinLink(link.id)).toBe(true);
    expect(listJoinLinks()).toHaveLength(0);
    expect(claimJoinLink(token, FRIEND, 'hunter22')).toBeNull();

    const stale = createJoinLink(INVITER, '');
    db.prepare('UPDATE join_links SET expires_at = ? WHERE id = ?').run(Date.now() - 1, stale.link.id);
    expect(claimJoinLink(stale.token, FRIEND, 'hunter22')).toBeNull();
  });

  it('lists joined members alongside the configured ones and removing one ends their sessions', () => {
    const { token } = createJoinLink(INVITER, '');
    const result = claimJoinLink(token, FRIEND, 'hunter22');
    expect(listMembers().find((m) => m.email === FRIEND)).toMatchObject({ invitedBy: INVITER, removable: true });
    expect(listMembers().find((m) => m.email === INVITER)).toMatchObject({ removable: false });

    expect(removeMember(FRIEND)).toBe(true);
    expect(isAllowed(FRIEND)).toBe(false);
    expect(resolveSession(result?.sessionToken)).toBeNull();
    expect(verifyPassword(FRIEND, 'hunter22')).toBe(false);
    expect(removeMember(INVITER)).toBe(false);
  });
});
