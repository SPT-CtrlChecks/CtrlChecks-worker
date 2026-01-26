// Execute Multimodal Agent Route
// Migrated from Supabase Edge Function
// Proxy to Python backend for multimodal AI processing

import { Request, Response } from 'express';
import { config } from '../core/config';

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// Get Python backend URL (FastAPI backend)
// Default to port 8000 which is the FastAPI backend
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body.task) {
    return { valid: false, error: "Task is required. Valid tasks: image_caption, story, image_prompt, text_to_image, summarize, translate, extract, sentiment, generate, qa" };
  }

  const validTasks = [
    "image_caption",
    "story",
    "image_prompt",
    "text_to_image",
    "summarize",
    "translate",
    "extract",
    "sentiment",
    "generate",
    "qa"
  ];

  if (!validTasks.includes(body.task)) {
    return { valid: false, error: `Invalid task. Must be one of: ${validTasks.join(", ")}` };
  }

  // For image tasks, require image
  if (["image_caption", "story", "image_prompt"].includes(body.task)) {
    if (!body.image || typeof body.image !== "string") {
      return { valid: false, error: "Image (base64) is required for image tasks" };
    }
    
    const isDataUrl = body.image.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,/);
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(body.image.replace(/\s/g, ''));
    
    if (!isDataUrl && !isBase64) {
      return { valid: false, error: "Image must be base64 encoded" };
    }
    
    const base64Length = isDataUrl ? body.image.split(',')[1]?.length || body.image.length : body.image.length;
    const estimatedSize = (base64Length * 3) / 4;
    if (estimatedSize > MAX_PAYLOAD_SIZE) {
      return { valid: false, error: `Image size exceeds maximum of ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB` };
    }
  }

  // For text tasks, require input text
  if (["text_to_image", "summarize", "translate", "extract", "sentiment", "generate", "qa"].includes(body.task)) {
    if (!body.input || typeof body.input !== "string" || body.input.trim().length === 0) {
      return { valid: false, error: "Input text is required for text tasks" };
    }
    
    if (body.input.length > 50000) {
      return { valid: false, error: "Input text exceeds maximum length of 50,000 characters" };
    }
  }
  
  // Validate text_to_image parameters
  if (body.task === "text_to_image") {
    if (body.steps && (typeof body.steps !== "number" || body.steps < 1 || body.steps > 4)) {
      return { valid: false, error: "steps must be a number between 1 and 4" };
    }
    if (body.guidance_scale && (typeof body.guidance_scale !== "number" || body.guidance_scale < 0 || body.guidance_scale > 1.5)) {
      return { valid: false, error: "guidance_scale must be a number between 0.0 and 1.5" };
    }
  }

  // Validate optional parameters
  if (body.sentence_count && (typeof body.sentence_count !== "number" || body.sentence_count < 2 || body.sentence_count > 10)) {
    return { valid: false, error: "sentence_count must be a number between 2 and 10" };
  }

  if (body.target_language && typeof body.target_language !== "string") {
    return { valid: false, error: "target_language must be a string" };
  }

  if (body.question && typeof body.question !== "string") {
    return { valid: false, error: "question must be a string" };
  }

  if (body.context && typeof body.context !== "string") {
    return { valid: false, error: "context must be a string" };
  }

  return { valid: true };
}

async function proxyToPythonBackend(payload: any): Promise<{ status: number; text: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

    console.log(`📤 Proxying ${payload.task} task to Python backend at ${PYTHON_BACKEND_URL}...`);

    const response = await fetch(`${PYTHON_BACKEND_URL}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    
    return { status: response.status, text: responseText };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        status: 504,
        text: JSON.stringify({
          success: false,
          error: "Request timeout. Python backend may be slow or unavailable.",
          details: "AI processing can take 10-30 seconds. Please try again."
        })
      };
    }
    
    console.error("Error proxying to Python backend:", error);
    return {
      status: 502,
      text: JSON.stringify({
        success: false,
        error: `Failed to connect to Python backend: ${error instanceof Error ? error.message : String(error)}`,
        details: `Ensure Python backend is running at ${PYTHON_BACKEND_URL} and PYTHON_BACKEND_URL is configured correctly.`
      })
    };
  }
}

export default async function executeMultimodalAgent(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

  try {
    // Check payload size
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      return res.status(413).json({
        success: false,
        error: `Payload size exceeds maximum of ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`,
      });
    }

    const body = req.body;

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || "Validation failed",
      });
    }

    // Prepare payload for Python backend
    const pythonPayload = {
      task: body.task,
      image: body.image || null,
      input: body.input || null,
      sentence_count: body.sentence_count || 5,
      target_language: body.target_language || null,
      question: body.question || null,
      context: body.context || null,
      steps: body.steps || null,
      guidance_scale: body.guidance_scale || null,
      options: body.options || {},
    };

    // Proxy to Python backend
    const proxyResponse = await proxyToPythonBackend(pythonPayload);
    const responseText = proxyResponse.text;
    const status = proxyResponse.status;
    
    res.status(status).json(JSON.parse(responseText));
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
