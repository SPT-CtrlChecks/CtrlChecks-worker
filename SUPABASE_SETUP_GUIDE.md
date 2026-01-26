# 🗄️ Supabase Database Setup Guide

This guide shows you what database tables, functions, and policies need to be set up in your Supabase project.

---

## 📋 Required Supabase Setup

### 1. **Database Tables**

Your application requires these core tables:

#### Core Tables
- ✅ `profiles` - User profile information
- ✅ `user_roles` - User role assignments (admin, moderator, user)
- ✅ `workflows` - User-created workflows
- ✅ `executions` - Workflow execution records
- ✅ `templates` - Global workflow templates
- ✅ `form_submissions` - Form submission data
- ✅ `agent_executions` - AI agent execution records
- ✅ `memory_sessions` - Conversation memory sessions
- ✅ `memory_messages` - Conversation messages
- ✅ `google_oauth_tokens` - Google API OAuth tokens

#### Optional Tables (for future features)
- `teams` - Team collaboration
- `team_members` - Team membership
- `team_invitations` - Team invitations
- `api_keys` - API key management

---

## 🚀 Quick Setup (Recommended)

### Step 1: Run Main Database Setup

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the contents of `ctrl_checks/sql_migrations/01_database_setup.sql`
5. Click **Run**

This creates:
- All enum types
- All core tables
- Row Level Security (RLS) policies
- Helper functions
- Triggers

### Step 2: Run Additional Migrations (In Order)

Run these SQL files in order:

1. **`02_agent_memory_tables.sql`** - Agent and memory system
2. **`03_google_oauth_tokens.sql`** - Google OAuth support
3. **`04_form_trigger_setup.sql`** - Form trigger functionality
4. **`05_role_based_templates.sql`** - Template system
5. **`06_update_signup_role_handling.sql`** - User signup handling

**Location:** `ctrl_checks/sql_migrations/`

---

## 📊 Required Database Schema

### Enum Types

```sql
- app_role: 'admin', 'moderator', 'user'
- workflow_status: 'draft', 'active', 'paused', 'archived'
- execution_status: 'pending', 'running', 'success', 'failed', 'cancelled', 'waiting'
- execution_trigger: 'manual', 'webhook', 'schedule', 'form'
- team_role: 'owner', 'admin', 'member', 'viewer'
- invitation_status: 'pending', 'accepted', 'rejected', 'expired'
```

### Core Tables Structure

#### `workflows` Table
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key to auth.users)
- name (TEXT)
- description (TEXT)
- nodes (JSONB) - Workflow nodes
- edges (JSONB) - Workflow connections
- status (workflow_status) - 'draft', 'active', 'paused', 'archived'
- schedule (TEXT) - Cron expression for scheduled workflows
- created_at, updated_at (TIMESTAMPTZ)
```

#### `executions` Table
```sql
- id (UUID, primary key)
- workflow_id (UUID, foreign key to workflows)
- user_id (UUID, foreign key to auth.users)
- status (execution_status)
- trigger (execution_trigger)
- input (JSONB)
- output (JSONB)
- error (TEXT)
- logs (JSONB)
- started_at, finished_at (TIMESTAMPTZ)
- waiting_for_node_id (UUID) - For form triggers
```

#### `templates` Table
```sql
- id (UUID, primary key)
- name (TEXT)
- description (TEXT)
- category (TEXT)
- nodes (JSONB)
- edges (JSONB)
- is_featured (BOOLEAN)
- is_active (BOOLEAN)
- use_count (INTEGER)
- created_at, updated_at (TIMESTAMPTZ)
```

---

## 🔐 Row Level Security (RLS)

The setup includes RLS policies for:
- ✅ Users can only see/edit their own workflows
- ✅ Users can only see their own executions
- ✅ Admins can manage templates
- ✅ Public read access for active templates
- ✅ Secure token storage for Google OAuth

---

## 🛠️ Required Functions

### Helper Functions
- `has_role(user_id, role)` - Check if user has a role
- `is_team_member(user_id, team_id)` - Check team membership
- `handle_new_user()` - Auto-create profile on signup

### Triggers
- `handle_new_user` - Creates profile when user signs up
- `update_updated_at` - Auto-updates `updated_at` timestamp

---

## ✅ Verification Checklist

After running the migrations, verify:

1. **Tables Exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```
   
   Should include: `workflows`, `executions`, `templates`, `profiles`, `user_roles`, etc.

2. **RLS is Enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```
   
   All tables should have `rowsecurity = true`

3. **Functions Exist:**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public';
   ```
   
   Should include: `has_role`, `is_team_member`, `handle_new_user`

---

## 🔧 Manual Setup (If Needed)

If you prefer to set up manually or need to fix specific issues:

### 1. Create Enum Types
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.workflow_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE public.execution_status AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled', 'waiting');
CREATE TYPE public.execution_trigger AS ENUM ('manual', 'webhook', 'schedule', 'form');
```

### 2. Create Core Tables
See `ctrl_checks/sql_migrations/01_database_setup.sql` for complete table definitions.

### 3. Enable RLS
```sql
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
-- ... (for all tables)
```

---

## 📝 Environment Variables

Make sure your `.env` file has:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these:**
1. Go to Supabase Dashboard → Settings → API
2. **Project URL** = `SUPABASE_URL`
3. **service_role key** = `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

---

## 🐛 Troubleshooting

### Error: "relation does not exist"
- **Solution:** Run `01_database_setup.sql` first

### Error: "permission denied"
- **Solution:** Check RLS policies are set up correctly
- **Solution:** Verify you're using the service_role key (not anon key)

### Error: "type does not exist"
- **Solution:** Run enum type creation statements first

### Scheduler not working
- **Solution:** Make sure `workflows` table has `schedule` column
- **Solution:** Verify workflows have `status = 'active'` and `schedule IS NOT NULL`

---

## 📚 Migration Files Location

All migration files are in:
```
ctrl_checks/sql_migrations/
```

Run them in numerical order (01, 02, 03, etc.)

---

## 🎯 Quick Start Command

If you have the Supabase CLI installed:

```bash
cd ctrl_checks
supabase db push
```

This will apply all migrations automatically.

---

## ✅ Next Steps

After database setup:

1. ✅ Verify tables exist
2. ✅ Test creating a workflow
3. ✅ Test executing a workflow
4. ✅ Verify scheduler can read workflows
5. ✅ Test form submissions

---

**Need Help?** Check the SQL migration files in `ctrl_checks/sql_migrations/` for detailed schema definitions.
