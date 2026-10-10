-- Enable Supabase Realtime for the problems table so the map updates on the go.
ALTER PUBLICATION supabase_realtime ADD TABLE problems;
