import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import {
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE,
  createInvite,
  createSession,
  destroySession,
  hasPassword,
  isAllowed,
  redeemInvite,
  setPassword,
  verifyPassword,
  requireAdmin,
  requireAuth,
  resolveSession,
  sessionTokenFrom,
  setSessionCookie,
} from './auth.js';
import {
  alertPrefsSchema,
  discordConfigured,
  getPrefs,
  setPrefs,
  startAlertLoop,
} from './alerts.js';
import { ClaudeUnavailableError } from './claude.js';
import { config } from './config.js';
import { draftInquiry } from './contact.js';
import { purgeExpired } from './db.js';
import { findListings, getListings } from './listings.js';
import { mailConfigured, sendSignInLink } from './mailer.js';
import { claudeSearch } from './search-agent.js';
import { SAVED_STATUSES, addNote, getSaved, listSaved, save, setStatus, unsave } from './shortlist.js';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser(config.sessionSecret));

/** Brute-forcing a 256-bit invite token is infeasible; this just caps the noise. */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const askLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10 });
/** Tighter than authLimiter: this route sends mail, so it is the abusable one. */
const signInLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 });

/**
 * Prefer the configured origin: the Host header is attacker-controlled, and
 * these URLs carry sign-in tokens.
 */
function publicBase(req: express.Request): string {
  return config.publicUrl || `${req.protocol}://${req.get('host')}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/redeem', authLimiter, (req, res) => {
  const body = z.object({ token: z.string().min(10).max(200) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid invite' });
    return;
  }

  const result = redeemInvite(body.data.token);
  if (!result) {
    res.status(401).json({ error: 'That invite is invalid, expired, or already used.' });
    return;
  }

  setSessionCookie(res, result.sessionToken);
  res.json({ email: result.email, isAdmin: result.email === config.adminEmail });
});

/**
 * Always reports success: telling a stranger whether an address is on the
 * allowlist would leak the roommate list.
 */
app.post('/api/auth/request-link', signInLimiter, async (req, res) => {
  const body = z.object({ email: z.string().email().max(320) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }

  if (!mailConfigured()) {
    res.status(503).json({ error: 'Email sign-in is not configured on this server.' });
    return;
  }

  // Answer before sending: waiting on SMTP only for allowlisted addresses would
  // turn response time into the oracle the generic response is there to avoid.
  res.json({ ok: true });

  const email = body.data.email.trim().toLowerCase();
  if (!isAllowed(email)) return;

  const base = publicBase(req);
  try {
    const invite = createInvite(email);
    await sendSignInLink(email, `${base}/invite/${invite.token}`, invite.expiresAt);
  } catch (error) {
    console.error('sign-in email failed:', error instanceof Error ? error.message : error);
  }
});

/**
 * A password is a convenience on top of the invite, never a way in on its own:
 * it can only be set from an already-signed-in session.
 */
app.post('/api/auth/password', requireAuth, (req, res) => {
  const body = z
    .object({ password: z.string().min(MIN_PASSWORD_LENGTH).max(200) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
    return;
  }

  const email = req.user?.email;
  if (!email) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  setPassword(email, body.data.password);
  res.json({ ok: true });
});

app.post('/api/auth/password/login', signInLimiter, (req, res) => {
  const body = z
    .object({ email: z.string().email().max(320), password: z.string().min(1).max(200) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Enter your email and password.' });
    return;
  }

  const email = body.data.email.trim().toLowerCase();
  if (!verifyPassword(email, body.data.password)) {
    res.status(401).json({ error: 'That email and password do not match. Email yourself a link instead.' });
    return;
  }

  setSessionCookie(res, createSession(email));
  res.json({ email, isAdmin: email === config.adminEmail });
});

app.get('/api/auth/me', (req, res) => {
  const user = resolveSession(sessionTokenFrom(req));
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  res.json({ ...user, hasPassword: hasPassword(user.email) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = sessionTokenFrom(req);
  if (token) destroySession(token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.post('/api/admin/invites', authLimiter, requireAuth, requireAdmin, (req, res) => {
  const body = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Provide a valid email address' });
    return;
  }

  try {
    const invite = createInvite(body.data.email);
    res.json({
      email: body.data.email,
      url: `${publicBase(req)}/invite/${invite.token}`,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not invite' });
  }
});

const listingsQuery = z.object({
  minRent: z.coerce.number().int().min(0).max(100_000).default(0),
  maxRent: z.coerce.number().int().min(1).max(100_000).default(8000),
  bedrooms: z.coerce.number().int().min(0).max(10).nullable().catch(null),
  limit: z.coerce.number().int().min(1).max(120).default(60),
});

app.get('/api/listings', requireAuth, async (req, res) => {
  const parsed = listingsQuery.safeParse({
    ...req.query,
    bedrooms: req.query.bedrooms === undefined || req.query.bedrooms === '' ? null : req.query.bedrooms,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid search parameters' });
    return;
  }

  try {
    res.json(await getListings(parsed.data));
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Search failed' });
  }
});

/** Claude plans the filter, the server runs it over every listing, Claude ranks. */
app.post('/api/search/claude', askLimiter, requireAuth, async (req, res) => {
  const body = z.object({ question: z.string().min(3).max(500) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Describe what you are looking for in 3 to 500 characters.' });
    return;
  }

  try {
    res.json(await claudeSearch(body.data.question));
  } catch (error) {
    const status = error instanceof ClaudeUnavailableError ? 503 : 502;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Claude failed' });
  }
});

app.get('/api/alerts/prefs', requireAuth, (req, res) => {
  res.json({
    prefs: getPrefs(req.user!.email),
    channels: { email: mailConfigured(), discord: discordConfigured() },
  });
});

app.put('/api/alerts/prefs', requireAuth, (req, res) => {
  const body = alertPrefsSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Those alert settings are not valid.' });
    return;
  }
  if (body.data.minRent > body.data.maxRent) {
    res.status(400).json({ error: 'Minimum rent cannot exceed maximum rent.' });
    return;
  }

  res.json({ prefs: setPrefs(req.user!.email, body.data) });
});

const listingKeyParam = z.string().min(3).max(200);

app.get('/api/saved', requireAuth, (_req, res) => {
  res.json({ saved: listSaved() });
});

app.post('/api/saved', requireAuth, async (req, res) => {
  const body = z.object({ listingKey: listingKeyParam }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Provide a listing key.' });
    return;
  }

  const [listing] = await findListings([body.data.listingKey]);
  if (!listing) {
    res.status(404).json({ error: 'That listing is no longer in the current results.' });
    return;
  }

  res.json({ saved: save(listing, req.user!.email) });
});

app.delete('/api/saved/:key', requireAuth, (req, res) => {
  const key = listingKeyParam.safeParse(req.params.key);
  if (!key.success || !unsave(key.data)) {
    res.status(404).json({ error: 'Not on the shortlist.' });
    return;
  }
  res.json({ ok: true });
});

app.patch('/api/saved/:key', requireAuth, (req, res) => {
  const key = listingKeyParam.safeParse(req.params.key);
  const body = z.object({ status: z.enum(SAVED_STATUSES) }).safeParse(req.body);
  if (!key.success || !body.success) {
    res.status(400).json({ error: `Status must be one of: ${SAVED_STATUSES.join(', ')}.` });
    return;
  }

  const saved = setStatus(key.data, body.data.status);
  if (!saved) {
    res.status(404).json({ error: 'Not on the shortlist.' });
    return;
  }
  res.json({ saved });
});

app.post('/api/saved/:key/notes', requireAuth, (req, res) => {
  const key = listingKeyParam.safeParse(req.params.key);
  const body = z.object({ body: z.string().trim().min(1).max(2000) }).safeParse(req.body);
  if (!key.success || !body.success) {
    res.status(400).json({ error: 'Write a note between 1 and 2000 characters.' });
    return;
  }

  const note = addNote(key.data, req.user!.email, body.data.body);
  if (!note) {
    res.status(404).json({ error: 'Save the listing before adding notes.' });
    return;
  }
  res.json({ note });
});

/** Returns a draft for the group to send themselves; the server never sends it. */
app.post('/api/contact-draft', askLimiter, requireAuth, async (req, res) => {
  const body = z
    .object({ listingKey: listingKeyParam, ask: z.string().max(500).default('') })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Provide a listing key.' });
    return;
  }

  const listing =
    getSaved(body.data.listingKey)?.listing ?? (await findListings([body.data.listingKey]))[0];
  if (!listing) {
    res.status(404).json({ error: 'That listing is no longer available.' });
    return;
  }

  try {
    res.json(await draftInquiry(listing, body.data.ask));
  } catch (error) {
    const status = error instanceof ClaudeUnavailableError ? 503 : 502;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Claude failed' });
  }
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

purgeExpired();
setInterval(purgeExpired, 60 * 60 * 1000).unref();
startAlertLoop();

app.listen(config.port, () => {
  console.log(`apartment-finder listening on http://localhost:${config.port}`);
  console.log(`allowlisted: ${config.allowedEmails.length} email(s)`);
  if (!config.enableCraigslist) {
    console.log('craigslist: disabled (set ENABLE_CRAIGSLIST=true if this host is not blocked)');
  }
  if (!mailConfigured()) {
    console.log('email sign-in: disabled (set SMTP_HOST, SMTP_USER, SMTP_PASS)');
  }
});
