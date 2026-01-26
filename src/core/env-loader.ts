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
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

console.log('\n📋 Environment Variables Status:');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing'} ${process.env.SUPABASE_URL ? `(${process.env.SUPABASE_URL.substring(0, 30)}...)` : ''}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'} ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '(***hidden***)' : ''}`);

if (missingVars.length > 0) {
  console.error('\n❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Please check your .env file in the worker directory.');
  console.error('   Make sure it contains:');
  console.error('   SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error('\n📝 You can copy env.example to .env as a starting point.');
  console.error(`   Current working directory: ${process.cwd()}\n`);
}
