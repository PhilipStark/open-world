-- Migration 01: Add civilization state + new event types
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS civ_state jsonb DEFAULT '{}';

-- Enable realtime for worlds too (for stage/milestone updates)
ALTER PUBLICATION supabase_realtime ADD TABLE worlds;
