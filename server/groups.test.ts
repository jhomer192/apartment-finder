import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import { deleteGroup, groupSchema, listGroups, saveGroup } from './groups.js';

const roommates = {
  name: 'Roommates',
  members: [
    { name: 'Garrett', email: 'garrett@example.com', phone: '' },
    { name: 'Justin', email: '', phone: '+1 415 555 0199' },
  ],
};

beforeEach(() => {
  db.prepare('DELETE FROM share_groups').run();
});

describe('share groups', () => {
  it('keeps everyone in the group with the way to reach them', () => {
    saveGroup(groupSchema.parse(roommates), 'jack@example.com');

    expect(listGroups()).toEqual([
      expect.objectContaining({
        name: 'Roommates',
        members: roommates.members,
        createdBy: 'jack@example.com',
      }),
    ]);
  });

  it('replaces a group saved under the same name rather than adding a second', () => {
    saveGroup(groupSchema.parse(roommates), 'jack@example.com');
    saveGroup(
      groupSchema.parse({ name: 'roommates', members: [{ name: 'Brady', email: 'brady@example.com' }] }),
      'garrett@example.com',
    );

    const groups = listGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((member) => member.name)).toEqual(['Brady']);
  });

  it('deletes a group once', () => {
    const saved = saveGroup(groupSchema.parse(roommates), 'jack@example.com');

    expect(deleteGroup(saved.id)).toBe(true);
    expect(deleteGroup(saved.id)).toBe(false);
    expect(listGroups()).toEqual([]);
  });

  it('rejects a contact nothing can be sent to', () => {
    expect(groupSchema.safeParse({ name: 'Parents', members: [{ name: 'Mum' }] }).success).toBe(false);
    expect(
      groupSchema.safeParse({ name: 'Parents', members: [{ name: 'Mum', email: 'not-an-address' }] }).success,
    ).toBe(false);
    expect(
      groupSchema.safeParse({ name: 'Parents', members: [{ name: 'Mum', phone: 'call me' }] }).success,
    ).toBe(false);
  });

  it('rejects an unnamed or empty group', () => {
    expect(groupSchema.safeParse({ name: '  ', members: roommates.members }).success).toBe(false);
    expect(groupSchema.safeParse({ name: 'Nobody', members: [] }).success).toBe(false);
  });
});
