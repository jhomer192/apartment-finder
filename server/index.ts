import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  createInvite,
  destroySession,
  isAllowed,
  redeemInvite,
  requireAdmin,
  requireAuth,
  resolveSession,
  setSessionCookie,
} from './auth.js';
import { ClaudeUnavailableError, askClaude } from './claude.js';
import { config } from './config.js';
import { purgeExpired } from './db.js';
import { getListings } from './listings.js';
import { mailConfigured, sendSignInLink } from './mailer.js';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

/** Brute-forcing a 256-bit invite token is infeasible; this just caps the noise. */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const askLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10 });
/** Tighter than authLimiter: this route sends mail, so it is the abusable one. */
const signInLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 });

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

  const email = body.data.email.trim().toLowerCase();
  if (isAllowed(email)) {
    try {
      const invite = createInvite(email);
      await sendSignInLink(email, `${publicBase(req)}/invite/${invite.token}`, invite.expiresAt);
    } catch (error) {
      console.error('sign-in email failed:', error instanceof Error ? error.message : error);
      res.status(502).json({ error: 'Could not send the email. Try again shortly.' });
      return;
    }
  }

  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = resolveSession(req.cookies?.[SESSION_COOKIE]);
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  res.json(user);
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
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

app.post('/api/ask', askLimiter, requireAuth, async (req, res) => {
  const body = z
    .object({
      question: z.string().min(3).max(2000),
      listingKeys: z.array(z.string().max(200)).max(20).default([]),
    })
    .safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: 'Ask a question between 3 and 2000 characters.' });
    return;
  }

  try {
    const { listings } = await getListings({ minRent: 0, maxRent: 100_000, bedrooms: null, limit: 60 });
    const selected = body.data.listingKeys.length
      ? listings.filter((listing) => body.data.listingKeys.includes(listing.key))
      : listings.slice(0, 20);

    const context = selected
      .map(
        (listing) =>
          `- ${listing.title} | $${listing.price}/mo | ${listing.bedrooms ?? '?'}bd | ` +
          `${listing.neighborhood} | scam risk ${listing.scam.score}/100 | ${listing.url}`,
      )
      .join('\n');

    const prompt = [
      'You are helping a group of roommates evaluate San Francisco rental listings.',
      'Answer using only the listings below. Be concise and specific.',
      '',
      'Listings:',
      context || '(no listings available)',
      '',
      `Question: ${body.data.question}`,
    ].join('\n');

    res.json({ answer: await askClaude(prompt) });
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
