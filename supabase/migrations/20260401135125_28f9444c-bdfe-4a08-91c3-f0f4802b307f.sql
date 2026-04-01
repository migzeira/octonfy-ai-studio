
-- WORKSPACES
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  mission text,
  products text,
  culture text,
  additional_notes text,
  plan text DEFAULT 'starter',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON public.workspaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON public.workspaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON public.workspaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON public.workspaces FOR DELETE USING (auth.uid() = user_id);

-- Helper function (after workspaces table exists)
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND user_id = auth.uid()
  )
$$;

-- AGENTS
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  specialty text,
  model text DEFAULT 'claude-sonnet',
  system_prompt text,
  status text DEFAULT 'idle',
  is_active boolean DEFAULT true,
  position_x float DEFAULT 100,
  position_y float DEFAULT 100,
  avatar_color text DEFAULT '#6366f1',
  credits_spent integer DEFAULT 0,
  messages_count integer DEFAULT 0,
  tasks_completed integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON public.agents FOR ALL USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  from_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  to_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  meeting_id uuid,
  content text NOT NULL,
  type text NOT NULL,
  tokens_used integer DEFAULT 0,
  credits_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON public.messages FOR ALL USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo',
  assigned_to uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  created_by text DEFAULT 'user',
  priority text DEFAULT 'medium',
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON public.tasks FOR ALL USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- DOCUMENTS
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text DEFAULT '',
  tags text[] DEFAULT '{}',
  created_by text DEFAULT 'user',
  updated_by text DEFAULT 'user',
  type text DEFAULT 'document',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON public.documents FOR ALL USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- MEETINGS
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  participants uuid[] DEFAULT '{}',
  status text DEFAULT 'scheduled',
  transcript jsonb DEFAULT '[]',
  summary text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON public.meetings FOR ALL USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- SCHEDULES
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  instruction text NOT NULL,
  frequency text NOT NULL,
  cron_expression text,
  scheduled_time time,
  scheduled_days text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_run timestamptz,
  next_run timestamptz,
  run_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON public.schedules FOR ALL USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- CREDITS
CREATE TABLE public.credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance integer DEFAULT 500,
  reserved integer DEFAULT 0,
  total_purchased integer DEFAULT 0,
  total_consumed integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_read" ON public.credits FOR SELECT USING (public.is_workspace_owner(workspace_id));
CREATE POLICY "workspace_insert" ON public.credits FOR INSERT WITH CHECK (public.is_workspace_owner(workspace_id));
CREATE POLICY "workspace_update" ON public.credits FOR UPDATE USING (public.is_workspace_owner(workspace_id));

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  amount integer NOT NULL,
  agent_id uuid,
  model text,
  tokens_input integer,
  tokens_output integer,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_read" ON public.transactions FOR SELECT USING (public.is_workspace_owner(workspace_id));
CREATE POLICY "workspace_insert" ON public.transactions FOR INSERT WITH CHECK (public.is_workspace_owner(workspace_id));

-- EVENT_LOGS
CREATE TABLE public.event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  actor text NOT NULL,
  target text,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_read" ON public.event_logs FOR SELECT USING (public.is_workspace_owner(workspace_id));
CREATE POLICY "workspace_insert" ON public.event_logs FOR INSERT WITH CHECK (public.is_workspace_owner(workspace_id));

-- INTEGRATIONS
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  is_connected boolean DEFAULT false,
  config jsonb DEFAULT '{}',
  connected_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON public.integrations FOR ALL USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credits_updated_at
  BEFORE UPDATE ON public.credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
