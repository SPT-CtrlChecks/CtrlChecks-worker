// LinkedIn OAuth Helper
// Similar to Google OAuth - uses Supabase OAuth provider

import { getSupabaseClient } from '../core/database/supabase-compat';

/**
 * Get LinkedIn access token for a user
 * @param supabase - Supabase client
 * @param userId - User ID or array of user IDs to try (in order)
 * @returns Access token or null if not found
 */
export async function getLinkedInAccessToken(
  supabase: any,
  userId: string | string[]
): Promise<string | null> {
  try {
    // Support both single user ID and array of user IDs (for fallback)
    const userIds = Array.isArray(userId) ? userId : [userId];
    
    // Try each user ID in order until we find a valid token
    for (const uid of userIds) {
      if (!uid) continue;
      
      const { data: tokenData, error } = await supabase
        .from('linkedin_oauth_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', uid)
        .single();

      if (error || !tokenData) {
        // Try next user ID
        continue;
      }

      const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      // Check if token is expired or about to expire
      if (expiresAt && expiresAt < fiveMinutesFromNow) {
        // Try to refresh if we have a refresh token
        if (tokenData.refresh_token) {
          const refreshedToken = await refreshLinkedInToken(
            supabase,
            uid,
            tokenData.refresh_token
          );
          if (refreshedToken) {
            return refreshedToken;
          }
          // Refresh failed - credentials might not be configured, but try using expired token anyway
          // The API call will fail with a proper error if token is truly invalid
          console.log('[LinkedIn OAuth] Token refresh failed (credentials may not be configured). Using existing token - it may be expired.');
          return tokenData.access_token;
        }
        // Token expired and no refresh token - try using it anyway, API will return proper error
        console.log('[LinkedIn OAuth] Token expired but no refresh token available. Using expired token - API call may fail.');
        return tokenData.access_token;
      }

      // Found valid token
      return tokenData.access_token;
    }

    // No valid token found for any user ID
    return null;
  } catch (error) {
    // Only log unexpected errors, not configuration issues
    console.error('[LinkedIn OAuth] Unexpected error getting access token:', error);
    return null;
  }
}

async function refreshLinkedInToken(
  supabase: any,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  try {
    // LinkedIn token refresh requires client credentials
    // For now, return null - Supabase OAuth should handle refresh automatically
    // If needed, we can add LinkedIn client ID/secret support later
    console.log('[LinkedIn OAuth] Token refresh not yet implemented. Supabase OAuth should handle refresh automatically.');
    return null;
  } catch (error) {
    console.error('[LinkedIn OAuth] Error refreshing token:', error);
    return null;
  }
}
