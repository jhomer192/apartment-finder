import { useState } from 'react';
import { useShareGroups } from '../hooks/useShareGroups';
import type { ShareMember } from '../api/types';

const BLANK: ShareMember = { name: '', email: '', phone: '' };

/**
 * Named groups of people to forward listings to, so sending a shortlist to two
 * roommates rather than all five is picking a name instead of retyping numbers.
 */
export function ShareGroupsPanel() {
  const { groups, save, remove } = useShareGroups();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<ShareMember[]>([{ ...BLANK }]);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<ShareMember>) {
    setMembers((current) => current.map((member, at) => (at === index ? { ...member, ...patch } : member)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const people = members
      .map((member) => ({ name: member.name.trim(), email: member.email.trim(), phone: member.phone.trim() }))
      .filter((member) => member.name || member.email || member.phone);
    const unreachable = people.find((member) => !member.email && !member.phone);
    const unnamed = people.find((member) => !member.name);

    if (unreachable) {
      setError(`${unreachable.name} needs an email address or a phone number.`);
      return;
    }
    if (unnamed) {
      setError('Give each person a name.');
      return;
    }
    if (!name.trim() || people.length === 0) {
      setError('Give the group a name and at least one person with an email or a phone number.');
      return;
    }

    try {
      await save({ name: name.trim(), members: people });
      setName('');
      setMembers([{ ...BLANK }]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that group');
    }
  }

  const field = 'text-xs px-2 py-1 rounded-lg border bg-transparent';
  const fieldStyle = { borderColor: 'var(--border)', color: 'var(--text)' };

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold" style={{ color: 'var(--text)' }}>
            {group.name}
          </span>
          <span style={{ color: 'var(--text-dim)' }}>
            {group.members.map((member) => member.name).join(', ')}
          </span>
          <button
            onClick={() => void remove(group.id)}
            className="ml-auto underline"
            style={{ color: '#ef4444' }}
          >
            delete
          </button>
        </div>
      ))}

      <form onSubmit={(event) => void submit(event)} className="space-y-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Group name, e.g. Roommates"
          maxLength={60}
          aria-label="Group name"
          className={`${field} w-full`}
          style={fieldStyle}
        />
        {members.map((member, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            <input
              value={member.name}
              onChange={(event) => update(index, { name: event.target.value })}
              placeholder="Name"
              maxLength={60}
              aria-label={`Person ${index + 1} name`}
              className={field}
              style={fieldStyle}
            />
            <input
              value={member.email}
              onChange={(event) => update(index, { email: event.target.value })}
              placeholder="Email (optional)"
              maxLength={120}
              aria-label={`Person ${index + 1} email`}
              className={field}
              style={fieldStyle}
            />
            <input
              value={member.phone}
              onChange={(event) => update(index, { phone: event.target.value })}
              placeholder="Phone (optional)"
              maxLength={25}
              aria-label={`Person ${index + 1} phone`}
              className={field}
              style={fieldStyle}
            />
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMembers((current) => [...current, { ...BLANK }])}
            className="text-xs px-2.5 py-1 rounded-lg border"
            style={fieldStyle}
          >
            Add person
          </button>
          <button
            type="submit"
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
            style={fieldStyle}
          >
            Save group
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </form>

      <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
        Sharing opens your own mail or messages app with the group filled in — nothing is sent from this server, and
        nobody needs an account here to read it.
      </p>
    </div>
  );
}
