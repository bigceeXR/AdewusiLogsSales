// build.js — run this as Vercel's build command: node build.js
// It reads env vars and injects them into a generated env.js file
const fs = require('fs');

const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  PAYSTACK_KEY: process.env.NEXT_PUBLIC_PAYSTACK_KEY || ''
};

const content = `window.__ENV__ = ${JSON.stringify(env)};`;
fs.writeFileSync('env.js', content);
console.log('env.js generated successfully.');
