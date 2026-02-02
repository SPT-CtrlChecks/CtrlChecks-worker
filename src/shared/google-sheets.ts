// Google Sheets API Helper
// Migrated from Supabase Edge Function

import { getSupabaseClient } from '../core/database/supabase-compat';
import { config } from '../core/config';

interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
  operation: 'read' | 'write' | 'append' | 'update';
  outputFormat?: 'json' | 'keyvalue' | 'text';
  readDirection?: 'rows' | 'columns';
  data?: unknown[][];
  accessToken: string;
}

interface GoogleSheetsResponse {
  success: boolean;
  data?: unknown;
  rows?: number;
  columns?: number;
  error?: string;
}

export async function getGoogleAccessToken(
  supabase: any,
  userId: string
): Promise<string | null> {
  try {
    // Check if credentials are configured before attempting any token operations
    const clientId = config.googleOAuthClientId;
    const clientSecret = config.googleOAuthClientSecret;
    
    if (!clientId || !clientSecret) {
      // Return null instead of throwing - this is an expected configuration state
      // The caller will handle this gracefully
      return null;
    }

    console.log(`[Google OAuth] Looking up token for user_id: ${userId}`);
    
    const { data: tokenData, error } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error(`[Google OAuth] Database query error:`, error);
      console.error(`[Google OAuth] Error details:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return null;
    }

    if (!tokenData) {
      console.warn(`[Google OAuth] No token found for user_id: ${userId}`);
      // Check if any tokens exist for debugging
      const { data: allTokens, error: checkError } = await supabase
        .from('google_oauth_tokens')
        .select('user_id')
        .limit(5);
      
      if (!checkError && allTokens) {
        console.log(`[Google OAuth] Found ${allTokens.length} token(s) in database for other users`);
      }
      return null;
    }

    console.log(`[Google OAuth] Token found for user_id: ${userId}, expires_at: ${tokenData.expires_at}`);

    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt && expiresAt < fiveMinutesFromNow) {
      if (tokenData.refresh_token) {
        const refreshedToken = await refreshGoogleToken(
          supabase,
          userId,
          tokenData.refresh_token
        );
        if (refreshedToken) {
          return refreshedToken;
        }
        // Refresh failed - return null so caller can handle gracefully
        return null;
      }
      // Token expired and no refresh token - return null
      return null;
    }

    return tokenData.access_token;
  } catch (error) {
    // Only log unexpected errors, not configuration issues
    console.error('[Google OAuth] Unexpected error getting access token:', error);
    return null;
  }
}

async function refreshGoogleToken(
  supabase: any,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const clientId = config.googleOAuthClientId;
    const clientSecret = config.googleOAuthClientSecret;

    if (!clientId || !clientSecret) {
      // Return null instead of throwing - credentials not configured
      return null;
    }

    console.log('[Google OAuth] Refreshing token for user:', userId);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Google OAuth] Token refresh failed:', errorText);
      return null;
    }

    const tokenData = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    const updateData: Record<string, unknown> = {
      access_token: tokenData.access_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (tokenData.refresh_token) {
      updateData.refresh_token = tokenData.refresh_token;
    }

    const { error: updateError } = await supabase
      .from('google_oauth_tokens')
      .update(updateData)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Google OAuth] Failed to update token in database:', updateError);
      return null;
    }

    console.log('[Google OAuth] Token refreshed successfully');
    return tokenData.access_token as string;
  } catch (error) {
    console.error('[Google OAuth] Error refreshing token:', error);
    return null;
  }
}

/**
 * Read data from Google Sheets
 */
async function readFromSheet(config: GoogleSheetsConfig): Promise<GoogleSheetsResponse> {
  try {
    const { spreadsheetId, sheetName, range, outputFormat = 'json', readDirection = 'rows' } = config;

    // Build range string
    let rangeStr = '';
    if (sheetName) {
      rangeStr = `'${sheetName}'`;
      if (range) {
        rangeStr += `!${range}`;
      }
    } else if (range) {
      rangeStr = range;
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeStr || 'A1:ZZZ9999'}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Google Sheets API error: ${response.status}`;

      if (response.status === 404) {
        errorMessage = 'Spreadsheet not found. Check the Spreadsheet ID.';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Make sure you have access to this spreadsheet.';
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed. Please re-authenticate with Google.';
      } else {
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json() as { values?: unknown[][]; range?: string };
    const values = data.values || [];

    if (values.length === 0) {
      return {
        success: true,
        data: readDirection === 'rows' ? [] : {},
        rows: 0,
        columns: 0,
      };
    }

    // Format data based on output format
    let formattedData: unknown;
    const rows = values.length;
    const columns = values[0]?.length || 0;

    if (outputFormat === 'keyvalue' && readDirection === 'rows') {
      // First row as headers
      const headers = (values[0] || []) as string[];
      formattedData = values.slice(1).map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
    } else if (outputFormat === 'text') {
      formattedData = values.map((row: unknown[]) => row.join('\t')).join('\n');
    } else if (readDirection === 'columns') {
      // Transpose: columns become rows
      const maxCols = Math.max(...values.map((row: unknown[]) => row.length));
      formattedData = Array.from({ length: maxCols }, (_, colIndex) =>
        values.map((row: unknown[]) => row[colIndex] || '')
      );
    } else {
      // Default: JSON array of arrays
      formattedData = values;
    }

    return {
      success: true,
      data: formattedData,
      rows,
      columns,
    };
  } catch (error) {
    console.error('Error reading from Google Sheets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error reading from Google Sheets',
    };
  }
}

/**
 * Write data to Google Sheets
 */
async function writeToSheet(config: GoogleSheetsConfig): Promise<GoogleSheetsResponse> {
  try {
    const { spreadsheetId, sheetName, range, data } = config;

    if (!data || !Array.isArray(data)) {
      return {
        success: false,
        error: 'Data must be a 2D array (array of rows)',
      };
    }

    // Build range string
    let rangeStr = '';
    if (sheetName) {
      rangeStr = `'${sheetName}'`;
      if (range) {
        rangeStr += `!${range}`;
      } else {
        // Default to A1 if no range specified
        rangeStr += '!A1';
      }
    } else if (range) {
      rangeStr = range;
    } else {
      rangeStr = 'A1';
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeStr}?valueInputOption=RAW`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Google Sheets API error: ${response.status}`;

      if (response.status === 404) {
        errorMessage = 'Spreadsheet not found. Check the Spreadsheet ID.';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Make sure you have write access to this spreadsheet.';
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed. Please re-authenticate with Google.';
      } else {
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    const result = await response.json() as {
      updatedCells?: number;
      updatedRange?: string;
    };
    const updatedCells = result.updatedCells || 0;

    return {
      success: true,
      data: {
        updatedCells,
        range: result.updatedRange || '',
      },
      rows: data.length,
      columns: data[0]?.length || 0,
    };
  } catch (error) {
    console.error('Error writing to Google Sheets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error writing to Google Sheets',
    };
  }
}

/**
 * Append data to Google Sheets
 */
async function appendToSheet(config: GoogleSheetsConfig): Promise<GoogleSheetsResponse> {
  try {
    const { spreadsheetId, sheetName, data } = config;

    if (!data || !Array.isArray(data)) {
      return {
        success: false,
        error: 'Data must be a 2D array (array of rows)',
      };
    }

    // Validate that data is a 2D array (array of arrays)
    if (data.length === 0) {
      return {
        success: false,
        error: 'Data array is empty',
      };
    }

    // Ensure all rows are arrays
    const validatedData: unknown[][] = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row)) {
        // If row is not an array, wrap it in an array
        validatedData.push([row]);
      } else {
        validatedData.push(row);
      }
    }

    // Build range string (sheet name only, API will append to end)
    // For append operation, we need to URL-encode the sheet name
    const rangeStr = sheetName ? encodeURIComponent(sheetName) : 'Sheet1';

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeStr}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: validatedData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Google Sheets API error: ${response.status}`;

      if (response.status === 404) {
        errorMessage = 'Spreadsheet not found. Check the Spreadsheet ID.';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Make sure you have write access to this spreadsheet.';
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed. Please re-authenticate with Google.';
      } else {
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    const result = await response.json() as {
      updates?: {
        updatedCells?: number;
        updatedRange?: string;
      };
    };
    const updatedCells = result.updates?.updatedCells || 0;
    const updatedRange = result.updates?.updatedRange || '';

    return {
      success: true,
      data: {
        updatedCells,
        range: updatedRange,
      },
      rows: validatedData.length,
      columns: validatedData[0]?.length || 0,
    };
  } catch (error) {
    console.error('Error appending to Google Sheets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error appending to Google Sheets',
    };
  }
}

/**
 * Main function to execute Google Sheets operations
 */
export async function executeGoogleSheetsOperation(
  config: GoogleSheetsConfig
): Promise<GoogleSheetsResponse> {
  const { operation } = config;

  switch (operation) {
    case 'read':
      return await readFromSheet(config);
    case 'write':
    case 'update':
      return await writeToSheet(config);
    case 'append':
      return await appendToSheet(config);
    default:
      return {
        success: false,
        error: `Unknown operation: ${operation}`,
      };
  }
}
