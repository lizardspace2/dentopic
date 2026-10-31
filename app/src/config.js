// Configuration Supabase — lue depuis .env (voir .env.example)
// Les clés ci-dessous sont les valeurs publiques du projet d'origine (fallback).
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://rgpoojpvhbxlabzdxfff.supabase.co'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJncG9vanB2aGJ4bGFiemR4ZmZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTE4MTksImV4cCI6MjEwMDU2NzgxOX0.iAkidXnDoMEPtS8FRdhgffZa6G2g4B_iNiMw2Kmuh2Q'
