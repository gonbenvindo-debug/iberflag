const path = require('path');
const dotenv = require('dotenv');
const { getMailConfigStatus } = require('../lib/server/mail-config');

const rootDir = path.resolve(__dirname, '..');
dotenv.config({
    path: [
        path.join(rootDir, '.env.local'),
        path.join(rootDir, '.env.vercel.local'),
        path.join(rootDir, '.env.test.local'),
        path.join(rootDir, '.env')
    ],
    override: false
});

const status = getMailConfigStatus();

console.log('Email configuration status:');
console.log(`- Active provider: ${status.activeProvider}`);
console.log(`- Resend: ${status.resend.configured ? 'configured' : 'waiting for credentials'}`);
if (!status.resend.configured) {
    console.log(`  Missing: ${status.resend.missing.join(', ') || 'none'}`);
}

console.log(`- SMTP fallback: ${status.smtp.configured ? 'configured' : 'waiting for credentials'}`);
if (!status.smtp.configured) {
    console.log(`  Missing: ${status.smtp.missing.join(', ') || 'none'}`);
}

console.log(`- IMAP sent copy: ${status.imap.configured ? 'configured' : 'optional / not configured'}`);
if (!status.imap.configured) {
    console.log(`  Missing: ${status.imap.missing.join(', ') || 'none'}`);
}

console.log('No secret values were printed.');
