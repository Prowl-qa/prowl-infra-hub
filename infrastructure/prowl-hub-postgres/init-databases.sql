-- prowl_infra_hub is created automatically via POSTGRES_DB env var.
-- This script creates the second database for prowl-hub (QA hunts).

SELECT 'CREATE DATABASE prowl_qa_hub OWNER prowl'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'prowl_qa_hub'
)\gexec
