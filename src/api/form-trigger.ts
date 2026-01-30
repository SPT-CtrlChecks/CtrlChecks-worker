// Form Trigger Route
// Migrated from Supabase Edge Function
// Handles form submissions and workflow resumption

import { Request, Response } from 'express';
import { getSupabaseClient } from '../core/database/supabase-compat';
import { config } from '../core/config';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Helper to escape HTML
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Helper to mask IP
function maskIP(ip: string): string {
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  } else if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length > 0) {
      return `${parts.slice(0, -1).join(":")}:xxxx`;
    }
  }
  return "unknown";
}

// Sanitize input
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.replace(/\0/g, '').trim();
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

// Validate form data
function validateFormData(formData: Record<string, any>, fields: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    const name = field.name || "";
    const value = formData[name];
    const required = field.required || false;

    if (required && (value === undefined || value === null || value === "")) {
      errors.push(`${field.label || name} is required`);
      continue;
    }

    if (!value) continue;

    const type = field.type || "text";
    
    if (type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        errors.push(`${field.label || name} must be a valid email address`);
      }
    } else if (type === "url") {
      try {
        new URL(String(value));
      } catch {
        errors.push(`${field.label || name} must be a valid URL`);
      }
    } else if (type === "number") {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`${field.label || name} must be a valid number`);
      } else {
        if (field.min !== undefined && num < field.min) {
          errors.push(`${field.label || name} must be at least ${field.min}`);
        }
        if (field.max !== undefined && num > field.max) {
          errors.push(`${field.label || name} must be at most ${field.max}`);
        }
      }
    } else if (type === "text" || type === "textarea") {
      const strValue = String(value);
      if (field.minLength !== undefined && strValue.length < field.minLength) {
        errors.push(`${field.label || name} must be at least ${field.minLength} characters`);
      }
      if (field.maxLength !== undefined && strValue.length > field.maxLength) {
        errors.push(`${field.label || name} must be at most ${field.maxLength} characters`);
      }
      if (field.pattern) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(strValue)) {
          errors.push(`${field.label || name} does not match the required format`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// GET /api/form-trigger/:workflowId/:nodeId - Get form config
export async function getFormConfig(req: Request, res: Response) {
  const supabase = getSupabaseClient();
  const { workflowId, nodeId } = req.params;

  try {
    // Verify workflow exists and is active
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({ error: "Workflow not found", message: "The requested workflow could not be found." });
    }

    if (workflow.status !== "active") {
      return res.status(400).json({ error: "Form expired", message: "This form is no longer active. The workflow has been deactivated." });
    }

    // Find the form node
    const nodes = workflow.nodes as any[];
    const formNode = nodes?.find((node: any) => 
      (node.id === nodeId || node.data?.id === nodeId) && 
      (node.data?.type === "form" || node.type === "form")
    );
    
    if (!formNode) {
      return res.status(404).json({ error: "Form not found", message: "The form node was not found in this workflow." });
    }

    const formConfig = formNode.data?.config || formNode.config || {};
    const formTitle = formConfig.formTitle || "Form Submission";
    const formDescription = formConfig.formDescription || "";
    
    let fields: any[] = [];
    if (Array.isArray(formConfig.fields)) {
      fields = formConfig.fields;
    } else if (typeof formConfig.fields === 'string') {
      try {
        fields = JSON.parse(formConfig.fields || '[]');
      } catch (e) {
        console.error("Failed to parse fields JSON:", e);
        fields = [];
      }
    }
    
    const submitButtonText = formConfig.submitButtonText || "Submit";
    const successMessage = formConfig.successMessage || "Thank you for your submission!";
    const redirectUrl = formConfig.redirectUrl || "";

    const formConfigResponse = {
      workflowId,
      nodeId,
      formTitle,
      formDescription,
      fields,
      submitButtonText,
      successMessage,
      redirectUrl,
      submitUrl: `${config.publicBaseUrl}/api/form-trigger/${workflowId}/${nodeId}/submit`,
    };

    return res.json(formConfigResponse);
  } catch (error) {
    console.error("Form trigger error:", error);
    return res.status(500).json({ 
      error: "Server error", 
      message: error instanceof Error ? error.message : "Internal server error" 
    });
  }
}

// POST /api/form-trigger/:workflowId/:nodeId/submit - Submit form
export async function submitForm(req: Request, res: Response) {
  const supabase = getSupabaseClient();
  const { workflowId, nodeId } = req.params;

  try {
    // Verify workflow exists and is active
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({ error: "Workflow not found", message: "The requested workflow could not be found." });
    }

    if (workflow.status !== "active") {
      return res.status(400).json({ error: "Form expired", message: "This form is no longer active. The workflow has been deactivated." });
    }

    // Find the form node
    const nodes = workflow.nodes as any[];
    const formNode = nodes?.find((node: any) => 
      (node.id === nodeId || node.data?.id === nodeId) && 
      (node.data?.type === "form" || node.type === "form")
    );
    
    if (!formNode) {
      return res.status(404).json({ error: "Form not found", message: "The form node was not found in this workflow." });
    }

    const formConfig = formNode.data?.config || formNode.config || {};
    const formTitle = formConfig.formTitle || "Form Submission";
    const successMessage = formConfig.successMessage || "Thank you for your submission!";
    const redirectUrl = formConfig.redirectUrl || "";
    
    let fields: any[] = [];
    if (Array.isArray(formConfig.fields)) {
      fields = formConfig.fields;
    } else if (typeof formConfig.fields === 'string') {
      try {
        fields = JSON.parse(formConfig.fields || '[]');
      } catch (e) {
        fields = [];
      }
    }

    // Get idempotency key from header or generate one
    const idempotencyKey = req.headers['x-idempotency-key'] as string || 
                          `form_${workflowId}_${nodeId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Check for duplicate submission (idempotency)
    const { data: existingSubmission } = await supabase
      .from("form_submissions")
      .select("execution_id")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingSubmission) {
      console.log("Duplicate submission detected, ignoring:", idempotencyKey);
      return res.json({ success: true, message: successMessage, duplicate: true });
    }

    // Parse form data
    let formData: Record<string, any> = {};
    let files: Array<{ fieldName: string; fileName: string; mimeType: string; data: string }> = [];

    // Handle multipart/form-data (files)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Use multer middleware - this should be applied before this handler
      // For now, parse from req.body and req.files
      formData = req.body || {};
      
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files as Express.Multer.File[]) {
          const base64Data = file.buffer.toString('base64');
          files.push({
            fieldName: file.fieldname,
            fileName: file.originalname,
            mimeType: file.mimetype || "application/octet-stream",
            data: base64Data,
          });
        }
      }
    } else {
      // JSON or form-urlencoded
      formData = req.body.formData || req.body.data || req.body;
      files = req.body.files || [];
    }

    // Validate form data
    const validationResult = validateFormData(formData, fields);
    if (!validationResult.valid) {
      return res.status(400).json({ error: "Validation failed", message: validationResult.errors.join(", ") });
    }

    // Extract metadata
    const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || "unknown";
    const userAgent = req.headers['user-agent'] || "unknown";
    const maskedIP = maskIP(String(clientIP));

    const submittedAt = new Date().toISOString();
    const meta = {
      submittedAt,
      ip: maskedIP,
      userAgent,
    };

    // Find waiting execution for this form node
    // First, let's check what executions exist for debugging
    const { data: allExecutions, error: allExecError } = await supabase
      .from("executions")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("started_at", { ascending: false })
      .limit(5);
    
    console.log(`[Form Submit] Looking for waiting execution - workflowId: ${workflowId}, nodeId: ${nodeId}`);
    console.log(`[Form Submit] Recent executions for this workflow:`, allExecutions?.map(e => ({
      id: e.id,
      status: e.status,
      trigger: e.trigger,
      waiting_for_node_id: e.waiting_for_node_id,
      started_at: e.started_at
    })));

    const { data: waitingExecution, error: waitError } = await supabase
      .from("executions")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("status", "waiting")
      .eq("trigger", "form")
      .eq("waiting_for_node_id", nodeId)
      .order("started_at", { ascending: true })
      .limit(1)
      .single();

    if (waitError || !waitingExecution) {
      console.error("No waiting execution found for form node:", nodeId, waitError);
      console.error("Searched for:", {
        workflow_id: workflowId,
        status: "waiting",
        trigger: "form",
        waiting_for_node_id: nodeId
      });
      
      // Try to find any waiting execution for this workflow (for debugging)
      const { data: anyWaiting } = await supabase
        .from("executions")
        .select("*")
        .eq("workflow_id", workflowId)
        .eq("status", "waiting")
        .limit(1);
      
      console.log("Any waiting executions found:", anyWaiting);
      
      return res.status(400).json({ 
        error: "No active form", 
        message: "This form is not currently waiting for a submission. Please activate the workflow first." 
      });
    }

    // Prepare form submission data (n8n-style output format)
    const submissionData = {
      submitted_at: submittedAt,
      form: {
        title: formTitle,
        id: nodeId,
      },
      data: sanitizeInput(formData),
      files: files,
      meta: meta,
    };

    // Store submission record (for idempotency and audit)
    await supabase
      .from("form_submissions")
      .insert({
        workflow_id: workflowId,
        node_id: nodeId,
        execution_id: waitingExecution.id,
        idempotency_key: idempotencyKey,
        form_data: submissionData,
        submitted_at: submittedAt,
      });

    // Update execution: set input and change status from "waiting" to "running"
    const executionInput = {
      submitted_at: submittedAt,
      form: {
        title: formTitle,
        id: nodeId,
      },
      data: submissionData.data,
      files: submissionData.files,
      meta: submissionData.meta,
    };

    const { error: updateError } = await supabase
      .from("executions")
      .update({
        status: "running",
        input: executionInput,
        waiting_for_node_id: null,
      })
      .eq("id", waitingExecution.id);

    if (updateError) {
      console.error("Failed to update execution:", updateError);
      return res.status(500).json({ 
        error: "Server error", 
        message: "Failed to process form submission. Please try again." 
      });
    }

    // Resume workflow execution asynchronously (don't wait for it)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Form Submit] Resuming workflow execution ${waitingExecution.id}...`);
    }
    
    // Get execute URL - require PUBLIC_BASE_URL in production
    let executeUrl: string;
    if (config.publicBaseUrl) {
      executeUrl = `${config.publicBaseUrl}/api/execute-workflow`;
    } else if (process.env.NODE_ENV === 'production') {
      console.error('[Form Submit] PUBLIC_BASE_URL is required in production');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'PUBLIC_BASE_URL environment variable is required in production.',
      });
    } else {
      executeUrl = 'http://localhost:3001/api/execute-workflow';
    }
    fetch(executeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflowId,
        executionId: waitingExecution.id,
        input: executionInput,
      }),
    })
    .then(async (response) => {
      if (response.ok) {
        const result = await response.json();
        console.log(`[Form Submit] Workflow resumed successfully:`, result);
      } else {
        const error = await response.text();
        console.error(`[Form Submit] Workflow resume failed (${response.status}):`, error);
      }
    })
    .catch((err) => {
      console.error("[Form Submit] Failed to resume workflow execution:", err);
    });

    // Return success response
    if (redirectUrl) {
      return res.json({ success: true, message: successMessage, redirect: redirectUrl });
    }

    return res.json({ success: true, message: successMessage });
  } catch (error) {
    console.error("Form trigger error:", error);
    return res.status(500).json({ 
      error: "Server error", 
      message: error instanceof Error ? error.message : "Internal server error" 
    });
  }
}

// Main handler with multer middleware
const uploadMiddleware = upload.any();

export default async function formTriggerHandler(req: Request, res: Response) {
  // Apply multer middleware for file uploads
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: "File upload error", message: err.message });
    }

    const { workflowId, nodeId } = req.params;
    
    // Check if this is a submit request - check multiple ways to be sure
    const originalUrl = req.originalUrl || '';
    const path = req.path || '';
    const url = req.url || '';
    const isSubmit = originalUrl.endsWith('/submit') || 
                     path.endsWith('/submit') || 
                     url.endsWith('/submit') ||
                     originalUrl.includes('/submit') ||
                     path.includes('/submit');

    console.log(`[Form Trigger] ${req.method} ${originalUrl} - workflowId: ${workflowId}, nodeId: ${nodeId}, isSubmit: ${isSubmit}`);

    if (req.method === 'GET') {
      return getFormConfig(req, res);
    } else if (req.method === 'POST') {
      // For POST, check if it's a submit request or just a regular form trigger
      if (isSubmit) {
        return submitForm(req, res);
      } else {
        // POST without /submit - treat as submit for backwards compatibility
        return submitForm(req, res);
      }
    } else {
      return res.status(405).json({ error: "Method not allowed", message: "This endpoint only supports GET and POST requests." });
    }
  });
}
