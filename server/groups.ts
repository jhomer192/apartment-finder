import { z } from 'zod';
import { db } from './db.js';

/**
 * Who a listing gets sent to. "Roommates" and "Parents" want very different
 * apartments forwarded to them, so sharing targets a named group rather than
 * making somebody retype four phone numbers each time.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS share_groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    members    TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

/** Digits, spaces and the punctuation phone numbers are written with. */
const PHONE = /^[+0-9][0-9 ()+.-]{5,24}$/;

export const memberSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(120).or(z.literal('')).default(''),
    phone: z.string().trim().regex(PHONE).or(z.literal('')).default(''),
  })
  // A contact with neither address nor number cannot be sent anything, and
  // silently keeping it would make "Text the group" quietly drop people.
  .refine((member) => member.email !== '' || member.phone !== '', {
    message: 'Give each person an email address or a phone number.',
  });

export const groupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  members: z.array(memberSchema).min(1).max(30),
});

export type ShareMember = z.infer<typeof memberSchema>;
export type ShareGroup = z.infer<typeof groupSchema>;

export interface StoredGroup extends ShareGroup {
  id: number;
  createdBy: string;
  createdAt: number;
}

interface GroupRow {
  id: number;
  name: string;
  members: string;
  created_by: string;
  created_at: number;
}

function parse(row: GroupRow): StoredGroup | null {
  const parsed = groupSchema.safeParse({
    name: row.name,
    members: JSON.parse(row.members) as unknown,
  });
  if (!parsed.success) return null;
  return { ...parsed.data, id: row.id, createdBy: row.created_by, createdAt: row.created_at };
}

export function listGroups(): StoredGroup[] {
  const rows = db
    .prepare('SELECT id, name, members, created_by, created_at FROM share_groups ORDER BY name COLLATE NOCASE')
    .all() as GroupRow[];
  return rows.map(parse).filter((group): group is StoredGroup => group !== null);
}

/** Saving under an existing name replaces it, the way saved searches work. */
export function saveGroup(group: ShareGroup, email: string, now = Date.now()): StoredGroup {
  const row = db
    .prepare(
      `INSERT INTO share_groups (name, members, created_by, created_at)
       VALUES (@name, @members, @email, @now)
       ON CONFLICT(name) DO UPDATE SET members = @members, created_by = @email, created_at = @now
       RETURNING id, name, members, created_by, created_at`,
    )
    .get({ name: group.name, members: JSON.stringify(group.members), email, now }) as GroupRow;

  return { ...group, id: row.id, createdBy: row.created_by, createdAt: row.created_at };
}

export function deleteGroup(id: number): boolean {
  return db.prepare('DELETE FROM share_groups WHERE id = ?').run(id).changes > 0;
}
