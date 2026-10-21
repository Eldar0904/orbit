CREATE TABLE projects (
 id serial PRIMARY KEY, name text NOT NULL, description text, status text NOT NULL DEFAULT 'active',
 color text NOT NULL DEFAULT '#6366f1', project_type text, kind text, stage text NOT NULL DEFAULT 'p1',
 location text, client text, budget integer, budget_spent integer NOT NULL DEFAULT 0,
 start_date date, end_date date, area integer, rooms integer, floors integer, note text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE members (
 id serial PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 avatar_url text, role text NOT NULL DEFAULT 'member', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tasks (
 id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 assignee_id integer REFERENCES members(id) ON DELETE SET NULL, title text NOT NULL, description text,
 status text NOT NULL DEFAULT 'todo', priority text NOT NULL DEFAULT 'medium', due_date date,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE project_managers (
 project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 member_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE, PRIMARY KEY(project_id,member_id)
);
CREATE TABLE project_documents (
 id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 name text NOT NULL, category text NOT NULL DEFAULT 'other', storage_key text, mime_type text, size_bytes integer,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activity (
 id serial PRIMARY KEY, type text NOT NULL, title text NOT NULL, entity_type text NOT NULL,
 entity_id integer NOT NULL, project_name text, assignee_name text, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO projects(name,budget,area) VALUES ('Unassigned legacy project',1411219426,28);
