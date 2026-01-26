// Scheduler Service
// Basic cron job execution for scheduled workflows

import { getSupabaseClient } from '../../core/database/supabase-compat';
import cron from 'node-cron';

interface ScheduledWorkflow {
  id: string;
  workflowId: string;
  schedule: string; // Cron expression
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

class SchedulerService {
  private supabase: any;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private initialized: boolean = false;

  constructor() {
    // Don't initialize Supabase client in constructor
    // Initialize lazily when start() is called
  }

  /**
   * Initialize Supabase client (lazy initialization)
   */
  private initializeSupabase() {
    if (!this.initialized) {
      try {
        this.supabase = getSupabaseClient();
        this.initialized = true;
      } catch (error) {
        console.warn('⚠️  Scheduler: Supabase not configured. Scheduler will not start.');
        console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable scheduler.');
        return false;
      }
    }
    return this.initialized;
  }

  /**
   * Start scheduler service
   */
  async start() {
    // Check if Supabase is configured
    if (!this.initializeSupabase()) {
      console.log('⏭️  Scheduler service skipped (Supabase not configured)');
      return;
    }

    console.log('🕐 Starting scheduler service...');
    
    // Load all scheduled workflows
    await this.loadScheduledWorkflows();
    
    // Set up periodic check for new schedules (every minute)
    cron.schedule('* * * * *', async () => {
      await this.loadScheduledWorkflows();
    });
    
    console.log('✅ Scheduler service started');
  }

  /**
   * Load and schedule all active workflows
   */
  private async loadScheduledWorkflows() {
    if (!this.initialized || !this.supabase) {
      return;
    }

    try {
      // First, try to check if schedule column exists by querying workflow metadata
      // If schedule column doesn't exist, gracefully skip scheduled workflows
      const { data: workflows, error } = await this.supabase
        .from('workflows')
        .select('id, name, status')
        .eq('status', 'active');

      if (error) {
        // Check if error is due to missing column
        if (error.code === '42703' || error.message?.includes('does not exist')) {
          // Schedule column doesn't exist - this is OK, just skip scheduled workflows
          // This happens when the database schema hasn't been migrated yet
          return;
        }
        console.error('Error loading scheduled workflows:', error);
        return;
      }

      if (!workflows) return;

      // Try to get schedule column if it exists (optional)
      // Query workflows with schedule column separately to avoid errors
      const { data: workflowsWithSchedule, error: scheduleError } = await this.supabase
        .from('workflows')
        .select('id, schedule')
        .eq('status', 'active')
        .not('schedule', 'is', null);

      // If schedule column doesn't exist, just return (no scheduled workflows)
      if (scheduleError && (scheduleError.code === '42703' || scheduleError.message?.includes('does not exist'))) {
        return; // No schedule column - skip scheduled workflows gracefully
      }

      // Merge schedule data if available
      const scheduleMap = new Map<string, string>();
      if (workflowsWithSchedule) {
        workflowsWithSchedule.forEach((w: any) => {
          if (w.schedule) {
            scheduleMap.set(w.id, w.schedule);
          }
        });
      }

      // Remove old jobs that are no longer active
      for (const [workflowId, job] of this.jobs.entries()) {
        const stillActive = workflows.some((w: any) => w.id === workflowId);
        if (!stillActive) {
          job.stop();
          this.jobs.delete(workflowId);
        }
      }

      // Add new jobs (only if schedule column exists and has values)
      for (const workflow of workflows) {
        const schedule = scheduleMap.get(workflow.id);
        if (!this.jobs.has(workflow.id) && schedule) {
          this.scheduleWorkflow(workflow.id, schedule);
        }
      }
    } catch (error) {
      console.error('Error in scheduler:', error);
    }
  }

  /**
   * Schedule a workflow
   */
  private scheduleWorkflow(workflowId: string, schedule: string) {
    try {
      const job = cron.schedule(schedule, async () => {
        await this.executeScheduledWorkflow(workflowId);
      });

      this.jobs.set(workflowId, job);
      console.log(`📅 Scheduled workflow ${workflowId} with schedule: ${schedule}`);
    } catch (error) {
      console.error(`Error scheduling workflow ${workflowId}:`, error);
    }
  }

  /**
   * Execute a scheduled workflow
   */
  private async executeScheduledWorkflow(workflowId: string) {
    try {
      console.log(`🚀 Executing scheduled workflow: ${workflowId}`);
      
      // Call execute-workflow endpoint
      const executeUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:3001'}/api/execute-workflow`;
      
      const response = await fetch(executeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId,
          input: {
            trigger: 'schedule',
            scheduled_at: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to execute scheduled workflow ${workflowId}:`, errorText);
      } else {
        console.log(`✅ Successfully executed scheduled workflow: ${workflowId}`);
      }
    } catch (error) {
      console.error(`Error executing scheduled workflow ${workflowId}:`, error);
    }
  }

  /**
   * Stop scheduler service
   */
  stop() {
    for (const [workflowId, job] of this.jobs.entries()) {
      job.stop();
      this.jobs.delete(workflowId);
    }
    console.log('🛑 Scheduler service stopped');
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();
