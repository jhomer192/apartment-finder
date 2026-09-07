import type {
  AlertPrefs,
  AlertSettings,
  ClaudeSearchResult,
  ContactChannel,
  ContactDraft,
  ContactEntry,
  ContactOutcome,
  DislikeSummary,
  HouseRules,
  InventoryStatus,
  JoinLink,
  ListingNote,
  Member,
  ListingsResponse,
  PlanRequest,
  TourPlan,
  SavedFilter,
  SavedListing,
  SavedStatus,
  ShareGroup,
  StoredGroup,
  StoredFilter,
  TourDay,
  SessionUser,
  StoredRules,
} from './types';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    return await request<SessionUser>('/api/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function redeemInvite(token: string): Promise<SessionUser> {
  return request('/api/auth/redeem', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function signInWithPassword(email: string, password: string): Promise<SessionUser> {
  return request('/api/auth/password/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function setPassword(password: string): Promise<{ ok: boolean }> {
  return request('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function requestSignInLink(email: string): Promise<{ ok: boolean }> {
  return request('/api/auth/request-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return request('/api/auth/logout', { method: 'POST' });
}

export function createInviteLink(email: string): Promise<{ email: string; url: string; expiresAt: number }> {
  return request('/api/admin/invites', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function previewJoinLink(token: string): Promise<{ invitedBy: string; expiresAt: number }> {
  return request(`/api/join/${encodeURIComponent(token)}`);
}

export function claimJoinLink(token: string, email: string, password: string): Promise<SessionUser> {
  return request(`/api/join/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchJoinLinks(): Promise<{ links: JoinLink[]; members: Member[] }> {
  return request('/api/join-links');
}

export function createJoinLink(label: string): Promise<{ url: string; link: JoinLink; links: JoinLink[] }> {
  return request('/api/join-links', { method: 'POST', body: JSON.stringify({ label }) });
}

export function revokeJoinLink(id: number): Promise<{ links: JoinLink[] }> {
  return request(`/api/join-links/${id}`, { method: 'DELETE' });
}

export function removeMember(email: string): Promise<{ members: Member[] }> {
  return request(`/api/members/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

export interface ListingQuery {
  minRent?: number;
  maxRent?: number;
  minBedrooms?: number | null;
  maxBedrooms?: number | null;
  limit?: number;
  dedupe?: boolean;
  includeHidden?: boolean;
}

export function fetchListings(query: ListingQuery, signal?: AbortSignal): Promise<ListingsResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && !Number.isNaN(value)) {
      params.set(key, String(value));
    }
  }
  const suffix = params.toString();
  return request(`/api/listings${suffix ? `?${suffix}` : ''}`, { signal });
}

export function fetchInventory(): Promise<InventoryStatus> {
  return request('/api/inventory');
}

export function startInventoryRefresh(): Promise<InventoryStatus> {
  return request('/api/inventory/refresh', { method: 'POST' });
}

export function fetchAlertPrefs(): Promise<AlertSettings> {
  return request('/api/alerts/prefs');
}

export function saveAlertPrefs(prefs: AlertPrefs): Promise<{ prefs: AlertPrefs }> {
  return request('/api/alerts/prefs', { method: 'PUT', body: JSON.stringify(prefs) });
}

export function fetchRules(): Promise<StoredRules> {
  return request('/api/rules');
}

export function saveRules(rules: HouseRules): Promise<StoredRules> {
  return request('/api/rules', { method: 'PUT', body: JSON.stringify(rules) });
}

export function fetchFilters(): Promise<{ filters: StoredFilter[] }> {
  return request('/api/filters');
}

export function saveFilter(filter: SavedFilter): Promise<{ filter: StoredFilter }> {
  return request('/api/filters', { method: 'POST', body: JSON.stringify(filter) });
}

export function deleteFilter(id: number): Promise<{ ok: boolean }> {
  return request(`/api/filters/${id}`, { method: 'DELETE' });
}

export function claudeSearch(
  question: string,
  history: Array<{ question: string; answer: string }> = [],
): Promise<ClaudeSearchResult> {
  return request('/api/search/claude', {
    method: 'POST',
    body: JSON.stringify({ question, history }),
  });
}

export function fetchDislikes(): Promise<DislikeSummary> {
  return request('/api/dislikes');
}

export function dislikeListing(listingKey: string): Promise<DislikeSummary> {
  return request(`/api/dislikes/${encodeURIComponent(listingKey)}`, { method: 'PUT' });
}

export function undislikeListing(listingKey: string): Promise<DislikeSummary> {
  return request(`/api/dislikes/${encodeURIComponent(listingKey)}`, { method: 'DELETE' });
}

export function fetchSaved(): Promise<{ saved: SavedListing[] }> {
  return request('/api/saved');
}

export function saveListing(listingKey: string): Promise<{ saved: SavedListing }> {
  return request('/api/saved', { method: 'POST', body: JSON.stringify({ listingKey }) });
}

export function unsaveListing(listingKey: string): Promise<{ ok: boolean }> {
  return request(`/api/saved/${encodeURIComponent(listingKey)}`, { method: 'DELETE' });
}

export function setSavedStatus(listingKey: string, status: SavedStatus): Promise<{ saved: SavedListing }> {
  return request(`/api/saved/${encodeURIComponent(listingKey)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function addSavedNote(listingKey: string, body: string): Promise<{ note: ListingNote }> {
  return request(`/api/saved/${encodeURIComponent(listingKey)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function fetchShareGroups(): Promise<{ groups: StoredGroup[] }> {
  return request('/api/share-groups');
}

export function saveShareGroup(group: ShareGroup): Promise<{ group: StoredGroup }> {
  return request('/api/share-groups', { method: 'POST', body: JSON.stringify(group) });
}

export function deleteShareGroup(id: number): Promise<{ ok: boolean }> {
  return request(`/api/share-groups/${id}`, { method: 'DELETE' });
}

export function fetchTours(): Promise<{ days: TourDay[] }> {
  return request('/api/tours');
}

export function bookTour(tour: {
  listingKey: string;
  startsAt: number;
  minutes: number;
  note: string;
}): Promise<{ days: TourDay[] }> {
  return request('/api/tours', { method: 'POST', body: JSON.stringify(tour) });
}

export function planTourDay(plan: PlanRequest): Promise<TourPlan> {
  return request('/api/tour-plan', { method: 'POST', body: JSON.stringify(plan) });
}

export function bookTourPlan(
  stops: { listingKey: string; startsAt: number }[],
  minutes: number,
): Promise<{ booked: number; days: TourDay[]; saved: SavedListing[] }> {
  return request('/api/tour-plan/book', { method: 'POST', body: JSON.stringify({ stops, minutes }) });
}

export function cancelTour(id: number): Promise<{ days: TourDay[] }> {
  return request(`/api/tours/${id}`, { method: 'DELETE' });
}

export function fetchContacts(): Promise<{ contacts: ContactEntry[] }> {
  return request('/api/contacts');
}

export function logContact(
  listingKey: string,
  via: ContactChannel,
  note = '',
): Promise<{ contacts: ContactEntry[] }> {
  return request('/api/contacts', { method: 'POST', body: JSON.stringify({ listingKey, via, note }) });
}

export function updateContact(
  id: number,
  changes: { outcome?: ContactOutcome; note?: string },
): Promise<{ contacts: ContactEntry[] }> {
  return request(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

export function deleteContact(id: number): Promise<{ contacts: ContactEntry[] }> {
  return request(`/api/contacts/${id}`, { method: 'DELETE' });
}

export function draftContactMessage(listingKey: string, ask = ''): Promise<ContactDraft> {
  return request('/api/contact-draft', {
    method: 'POST',
    body: JSON.stringify({ listingKey, ask }),
  });
}
