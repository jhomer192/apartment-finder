import { createInvite } from '../auth.js';
import { config } from '../config.js';

const [email] = process.argv.slice(2);
const baseUrl = process.env.PUBLIC_URL ?? `http://localhost:${config.port}`;

if (!email) {
  console.error('Usage: npm run invite -- <email>');
  console.error(`Allowlisted: ${config.allowedEmails.join(', ')}`);
  process.exit(1);
}

try {
  const { token, expiresAt } = createInvite(email);
  console.log(`\nInvite for ${email}:`);
  console.log(`${baseUrl}/invite/${token}`);
  console.log(`\nSingle use, expires ${new Date(expiresAt).toLocaleString()}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
