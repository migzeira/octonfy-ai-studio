
-- ── Rooms table ─────────────────────────────────────────────────────────────
-- Stores named room regions inside a workspace's virtual office.
-- type values: 'work' | 'meeting' | 'break' | 'ceo' | 'generic'
CREATE TABLE IF NOT EXISTS public.rooms (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  type          text        NOT NULL DEFAULT 'generic',
  floor_col     integer     NOT NULL DEFAULT 0,
  floor_row     integer     NOT NULL DEFAULT 0,
  width_tiles   integer     NOT NULL DEFAULT 4,
  height_tiles  integer     NOT NULL DEFAULT 4,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_rooms_all"
  ON public.rooms FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- ── Desk assignment: reuse existing position_x / position_y columns on agents
-- position_x → tile column of the agent's assigned desk seat
-- position_y → tile row  of the agent's assigned desk seat
-- No schema change needed — columns already exist from the initial migration.
-- This comment documents the intended usage of those fields.

COMMENT ON COLUMN public.agents.position_x IS
  'Tile column (col) of the agent''s assigned desk seat in the virtual office.';
COMMENT ON COLUMN public.agents.position_y IS
  'Tile row of the agent''s assigned desk seat in the virtual office.';
