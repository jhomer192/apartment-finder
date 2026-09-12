import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { checkReplies, deleteContact, fetchContacts, logContact, updateContact } from '../api/client';
import type { ContactEntry } from '../api/types';
import { ContactsContext, type Contacts } from '../hooks/useContacts';
import { useShortlist } from '../hooks/useShortlist';

/**
 * The contact log is the group's, not one roommate's: the point is knowing a
 * landlord has already been emailed before you email them too.
 */
export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [replyTracking, setReplyTracking] = useState(false);
  const { reload: reloadShortlist } = useShortlist();

  useEffect(() => {
    let live = true;
    fetchContacts()
      .then((data) => {
        if (!live) return;
        setContacts(data.contacts);
        setReplyTracking(data.replyTracking);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not load the contact log');
      });
    return () => {
      live = false;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<{ contacts: ContactEntry[] }>) => {
    try {
      setContacts((await action()).contacts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work');
    }
  }, []);

  const value = useMemo<Contacts>(() => {
    const byListing = new Map<string, ContactEntry[]>();
    for (const entry of contacts) {
      const list = byListing.get(entry.listingKey) ?? [];
      list.push(entry);
      byListing.set(entry.listingKey, list);
    }
    return {
      byListing,
      error,
      replyTracking,
      checkReplies: async () => {
        let changed = 0;
        await run(async () => {
          const data = await checkReplies();
          changed = data.changed;
          return data;
        });
        return changed;
      },
      log: async (listingKey, via, note = '') => {
        await run(() => logContact(listingKey, via, note));
        // Logging a contact may have advanced the saved status server-side.
        reloadShortlist();
      },
      update: (id, changes) => run(() => updateContact(id, changes)),
      remove: async (id) => {
        await run(() => deleteContact(id));
        reloadShortlist();
      },
      replace: (next) => {
        setContacts(next);
        reloadShortlist();
      },
    };
  }, [contacts, error, replyTracking, run, reloadShortlist]);

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}
