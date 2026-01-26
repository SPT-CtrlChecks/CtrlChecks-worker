// CORS Middleware for Express

import { Request, Response, NextFunction } from 'express';
import { corsHeaders } from '../../shared/cors';
import { config } from '../config';

// Allowed origins - can be configured via environment variables
const getAllowedOrigins = (): string[] => {
  const origins = [
    'http://localhost:5173',  // Vite dev server (default)
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost:8080',  // Alternative Vite port
    'http://127.0.0.1:8080',
  ];

  // Add environment variable origins
  if (config.corsOrigin) {
    const envOrigins = config.corsOrigin.split(',').map((o: string) => o.trim());
    origins.push(...envOrigins);
  }

  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim());
    origins.push(...envOrigins);
  }

  // Remove duplicates
  return [...new Set(origins)];
};

const allowedOrigins = getAllowedOrigins();

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow requests with no origin (like mobile apps or curl requests)
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // Log blocked origin for debugging
    console.warn(`⚠️  CORS: Blocked origin ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
  }

  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
  res.setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Credentials', corsHeaders['Access-Control-Allow-Credentials']);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
}
