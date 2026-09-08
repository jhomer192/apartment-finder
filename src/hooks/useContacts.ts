import { createContext, useContext } from 'react';
import type { ContactChannel, ContactEntry, ContactOutcome } from '../api/types';

export interface Contacts {
  /** Newest first, per listing key. */
  byListing: Map<string, ContactEntry[]>;
  error: string | null;
  log(listingKey: string, via: ContactChannel, note?: string): Promise<void>;
  update(id: number, changes: { outcome?: ContactOutcome; note?: string }): Promise<void>;
  remove(id: number): Promise<void>;
  /** Adopt a contact list another endpoint returned alongside its own result. */
  replace(contacts: ContactEntry[]): void;
}

export const ContactsContext = createContext<Contacts | null>(null);

export function useContacts(): Contacts {
  const contacts = useContext(ContactsContext);
  if (!contacts) throw new Error('useContacts must be used inside ContactsProvider');
  return contacts;
}
