// Supabase-compatible database client
// Provides same interface as Supabase client for easy migration

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Check if Supabase is configured (allow empty strings to be treated as not configured)
  const hasUrl = config.supabaseUrl && config.supabaseUrl.trim() !== '';
  const hasKey = config.supabaseKey && config.supabaseKey.trim() !== '';
  
  if (!hasUrl || !hasKey) {
    const missing = [];
    if (!hasUrl) missing.push('SUPABASE_URL');
    if (!hasKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    
    console.error('\n❌ Supabase configuration error:');
    console.error(`   Missing: ${missing.join(', ')}`);
    console.error(`   SUPABASE_URL: ${hasUrl ? '✓ Set' : '✗ Missing'}`);
    console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${hasKey ? '✓ Set' : '✗ Missing'}`);
    console.error('\n💡 Make sure you have a .env file in the worker directory with:');
    console.error('   SUPABASE_URL=https://your-project.supabase.co');
    console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n');
    
    throw new Error(`Supabase URL and Service Role Key are required. Missing: ${missing.join(', ')}. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.`);
  }

  supabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Create a new Supabase client instance
 */
export function createSupabaseClient(url?: string, key?: string): SupabaseClient {
  const supabaseUrl = url || config.supabaseUrl;
  const supabaseKey = key || config.supabaseKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and Service Role Key are required.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
