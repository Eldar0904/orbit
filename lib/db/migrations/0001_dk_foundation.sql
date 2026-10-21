BEGIN;
CREATE TABLE workspaces (
  id serial PRIMARY KEY, name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspace_memberships (
  id serial PRIMARY KEY, workspace_id integer NOT NULL REFERENCES workspaces(id),
  clerk_subject text NOT NULL, role text NOT NULL CHECK(role IN ('admin','editor','viewer')),
  can_review_imports boolean NOT NULL DEFAULT false,
  CONSTRAINT workspace_subject_unique UNIQUE(workspace_id, clerk_subject)
);
-- Deliberately nullable: legacy rows stay inaccessible until explicitly assigned.
ALTER TABLE projects ADD COLUMN workspace_id integer REFERENCES workspaces(id);
ALTER TABLE projects ADD COLUMN equipment_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN reporting_currency text CHECK(reporting_currency IN ('KZT','USD','CNY'));
ALTER TABLE projects ADD COLUMN approved_purchase_budget numeric(20,2) CHECK(approved_purchase_budget >= 0);
ALTER TABLE projects ADD CONSTRAINT equipment_budget_currency CHECK(approved_purchase_budget IS NULL OR reporting_currency IS NOT NULL);
ALTER TABLE members ADD COLUMN workspace_id integer REFERENCES workspaces(id);
ALTER TABLE activity ADD COLUMN project_id integer;
CREATE TABLE project_memberships (
  id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clerk_subject text NOT NULL, role text NOT NULL CHECK(role IN ('editor','viewer')),
  CONSTRAINT project_subject_unique UNIQUE(project_id, clerk_subject)
);
CREATE TABLE equipment_sites (
  id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id),
  code text NOT NULL, name text NOT NULL, region text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_site_code_unique UNIQUE(project_id,code)
);
CREATE TABLE equipment_rooms (
  id serial PRIMARY KEY, site_id integer NOT NULL REFERENCES equipment_sites(id),
  code text NOT NULL, name text NOT NULL, number_text text,
  area_m2 numeric(12,2) CHECK(area_m2 >= 0), technical jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_room_code_unique UNIQUE(site_id,code)
);
CREATE TABLE equipment_imports (
  id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id),
  source_book_id text NOT NULL, captured_at timestamptz NOT NULL,
  content_hash text NOT NULL, mapping_version text NOT NULL DEFAULT 'dk-discovery-v1',
  status text NOT NULL DEFAULT 'staged' CHECK(status = 'staged'),
  payload jsonb NOT NULL, summary jsonb NOT NULL, created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_import_content_unique UNIQUE(project_id,content_hash,mapping_version)
);
CREATE TABLE audit_events (
  id serial PRIMARY KEY, workspace_id integer NOT NULL REFERENCES workspaces(id),
  project_id integer REFERENCES projects(id), actor text NOT NULL, action text NOT NULL,
  entity_type text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END;
$$;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE FUNCTION reject_source_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Source captures are immutable'; END;
$$;
CREATE TRIGGER source_captures_immutable BEFORE UPDATE OR DELETE ON equipment_imports
FOR EACH ROW EXECUTE FUNCTION reject_source_mutation();
CREATE INDEX equipment_sites_project ON equipment_sites(project_id);
CREATE INDEX equipment_rooms_site ON equipment_rooms(site_id);
CREATE INDEX equipment_imports_project ON equipment_imports(project_id);
CREATE INDEX projects_workspace ON projects(workspace_id);
CREATE INDEX audit_project ON audit_events(project_id,created_at);
COMMIT;
