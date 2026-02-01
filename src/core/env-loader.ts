// Load environment variables before any other modules
// This must be imported FIRST in index.ts

import dotenv from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';

// Try to find .env file in common locations
const possibleEnvPaths = [
  join(__dirname, '..', '..', '.env'),           // From compiled dist/ directory
  join(process.cwd(), '.env'),                   // Current working directory
  join(process.cwd(), 'worker', '.env'),         // If running from project root
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    const envResult = dotenv.config({ path: envPath });
    if (!envResult.error) {
      console.log(`✅ Loaded .env from: ${envPath}`);
      envLoaded = true;
      break;
    }
  }
}

// Fallback to default location (current working directory)
if (!envLoaded) {
  const envResult = dotenv.config();
  if (envResult.error) {
    console.warn(`⚠️  Warning: Could not load .env file from any expected location`);
    console.warn(`   Tried: ${possibleEnvPaths.join(', ')}`);
    console.warn(`   Current working directory: ${process.cwd()}`);
  } else {
    console.log(`✅ Loaded .env from current directory`);
  }
}

// Validate required environment variables at startup
// Support both standard naming and VITE_ prefix (for shared .env files)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const missingVars: string[] = [];
if (!supabaseUrl) missingVars.push('SUPABASE_URL or VITE_SUPABASE_URL');
if (!supabaseKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY');

console.log('\n📋 Environment Variables Status:');
const urlSource = process.env.SUPABASE_URL ? 'SUPABASE_URL' : process.env.VITE_SUPABASE_URL ? 'VITE_SUPABASE_URL' : 'none';
const keySource = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'VITE_SUPABASE_SERVICE_ROLE_KEY' : 'none';
console.log(`   Supabase URL: ${supabaseUrl ? '✓ Set' : '✗ Missing'} ${supabaseUrl ? `(${supabaseUrl.substring(0, 30)}...)` : ''} ${urlSource !== 'none' ? `[from ${urlSource}]` : ''}`);
console.log(`   Supabase Key: ${supabaseKey ? '✓ Set' : '✗ Missing'} ${supabaseKey ? '(***hidden***)' : ''} ${keySource !== 'none' ? `[from ${keySource}]` : ''}`);

if (missingVars.length > 0) {
  console.error('\n❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Please check your .env file in the worker directory.');
  console.error('   Make sure it contains one of these:');
  console.error('   SUPABASE_URL=https://your-project.supabase.co');
  console.error('   OR VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error('   OR VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error('\n📝 You can copy env.example to .env as a starting point.');
  console.error(`   Current working directory: ${process.cwd()}\n`);
}
