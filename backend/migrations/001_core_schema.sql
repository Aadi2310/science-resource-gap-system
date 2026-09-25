CREATE TYPE user_role AS ENUM ('SCHOOL','NGO','ADMIN','FIELD_COORDINATOR');
CREATE TYPE school_type AS ENUM ('GOVERNMENT','AIDED','PRIVATE');
CREATE TYPE verification_status AS ENUM ('PENDING','VERIFIED','REJECTED');
CREATE TYPE assessment_status AS ENUM ('DRAFT','SUBMITTED','VERIFIED','REJECTED');
CREATE TYPE condition_rating AS ENUM ('GOOD','FAIR','POOR','NOT_APPLICABLE');
CREATE TYPE alternative_rating AS ENUM ('NONE','PARTIAL','FULL');
CREATE TYPE priority_class AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW');
CREATE TYPE requirement_status AS ENUM ('OPEN','UNDER_REVIEW','ACCEPTED','IN_PROGRESS','PARTIALLY_COMPLETED','COMPLETED','NOT_FEASIBLE','DISPUTED','CLOSED');
CREATE TYPE feedback_source AS ENUM ('NGO','SCHOOL','ADMIN');
CREATE TYPE feedback_confirmation AS ENUM ('CONFIRMED','DISPUTED');

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) NOT NULL, password_hash varchar(255) NOT NULL,
  role user_role NOT NULL, full_name varchar(150) NOT NULL, phone varchar(20), is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
CREATE TABLE schools (
  school_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE RESTRICT,
  school_name varchar(255) NOT NULL, udise_code varchar(20) UNIQUE,
  school_type school_type NOT NULL, district varchar(100) NOT NULL, state varchar(100) NOT NULL, address text,
  latitude decimal(9,6), longitude decimal(9,6), student_strength_total integer NOT NULL CHECK(student_strength_total >= 0),
  contact_person varchar(150), contact_phone varchar(20), verification_status verification_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
  CHECK (udise_code IS NULL OR udise_code ~ '^[0-9]{11}$')
);
CREATE TABLE organizations (
  org_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE RESTRICT,
  org_name varchar(255) NOT NULL, registration_number varchar(100), focus_areas varchar(255)[], service_districts varchar(100)[],
  verification_status verification_status NOT NULL DEFAULT 'PENDING', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE field_coordinator_schools (
  coordinator_user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(coordinator_user_id, school_id)
);
CREATE TABLE resource_categories (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL UNIQUE,
  importance_weight integer NOT NULL CHECK(importance_weight BETWEEN 0 AND 100), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE resources (
  resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid NOT NULL REFERENCES resource_categories(category_id) ON DELETE RESTRICT,
  name varchar(150) NOT NULL, unit_of_measure varchar(30) NOT NULL, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(category_id,name)
);
CREATE TABLE assessments (
  assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE RESTRICT,
  submitted_by uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT, assessment_date date NOT NULL,
  status assessment_status NOT NULL DEFAULT 'DRAFT', version_number integer NOT NULL DEFAULT 1 CHECK(version_number > 0), version integer NOT NULL DEFAULT 1,
  idempotency_key uuid NOT NULL, verified_by uuid REFERENCES users(user_id) ON DELETE RESTRICT, verified_at timestamptz,
  rejection_reason text, supersedes_assessment_id uuid REFERENCES assessments(assessment_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id,idempotency_key), CHECK(status <> 'REJECTED' OR length(trim(coalesce(rejection_reason,''))) > 0)
);
CREATE INDEX assessments_school_date_idx ON assessments(school_id, assessment_date DESC);
CREATE TABLE school_resources (
  school_resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id uuid NOT NULL REFERENCES assessments(assessment_id) ON DELETE RESTRICT,
  resource_id uuid NOT NULL REFERENCES resources(resource_id) ON DELETE RESTRICT,
  required_qty integer NOT NULL CHECK(required_qty >= 0), available_qty integer NOT NULL CHECK(available_qty >= 0),
  functional_qty integer NOT NULL CHECK(functional_qty >= 0 AND functional_qty <= available_qty),
  condition_rating condition_rating NOT NULL, has_alternative alternative_rating NOT NULL DEFAULT 'NONE',
  students_affected integer CHECK(students_affected >= 0), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(assessment_id,resource_id),
  CHECK ((available_qty = 0 AND condition_rating = 'NOT_APPLICABLE') OR (available_qty > 0 AND condition_rating <> 'NOT_APPLICABLE'))
);
CREATE TABLE gap_records (
  gap_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_resource_id uuid NOT NULL UNIQUE REFERENCES school_resources(school_resource_id) ON DELETE RESTRICT,
  gap_qty integer NOT NULL CHECK(gap_qty >= 0), gap_ratio decimal(5,4) NOT NULL CHECK(gap_ratio BETWEEN 0 AND 1),
  computed_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE weight_configs (
  config_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), severity_weight decimal(4,3) NOT NULL,
  importance_weight decimal(4,3) NOT NULL, students_weight decimal(4,3) NOT NULL,
  alternative_weight decimal(4,3) NOT NULL, condition_weight decimal(4,3) NOT NULL,
  critical_threshold integer NOT NULL DEFAULT 80, high_threshold integer NOT NULL DEFAULT 60, medium_threshold integer NOT NULL DEFAULT 40,
  is_active boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (severity_weight >= 0 AND importance_weight >= 0 AND students_weight >= 0 AND alternative_weight >= 0 AND condition_weight >= 0),
  CHECK (abs(severity_weight + importance_weight + students_weight + alternative_weight + condition_weight - 1.000) <= 0.001),
  CHECK (critical_threshold BETWEEN 0 AND 100 AND critical_threshold > high_threshold AND high_threshold > medium_threshold AND medium_threshold >= 0)
);
CREATE UNIQUE INDEX one_active_weight_config ON weight_configs(is_active) WHERE is_active;
CREATE TABLE priority_scores (
  score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_resource_id uuid NOT NULL REFERENCES school_resources(school_resource_id) ON DELETE RESTRICT,
  weight_config_id uuid NOT NULL REFERENCES weight_configs(config_id) ON DELETE RESTRICT,
  severity_score decimal(5,2) NOT NULL CHECK(severity_score BETWEEN 0 AND 100),
  importance_score decimal(5,2) NOT NULL CHECK(importance_score BETWEEN 0 AND 100),
  students_score decimal(5,2) NOT NULL CHECK(students_score BETWEEN 0 AND 100),
  alternative_score decimal(5,2) NOT NULL CHECK(alternative_score BETWEEN 0 AND 100),
  condition_score decimal(5,2) NOT NULL CHECK(condition_score BETWEEN 0 AND 100),
  final_score decimal(5,2) NOT NULL CHECK(final_score BETWEEN 0 AND 100), priority_class priority_class NOT NULL,
  computed_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX priority_scores_resource_latest_idx ON priority_scores(school_resource_id, computed_at DESC);
CREATE TABLE requirements (
  requirement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(school_id) ON DELETE RESTRICT,
  resource_id uuid NOT NULL REFERENCES resources(resource_id) ON DELETE RESTRICT, gap_id uuid NOT NULL REFERENCES gap_records(gap_id) ON DELETE RESTRICT,
  score_id uuid NOT NULL REFERENCES priority_scores(score_id) ON DELETE RESTRICT,
  status requirement_status NOT NULL DEFAULT 'OPEN', assigned_org_id uuid REFERENCES organizations(org_id) ON DELETE RESTRICT,
  fulfilled_qty integer NOT NULL DEFAULT 0 CHECK(fulfilled_qty >= 0), accepted_gap_qty integer NOT NULL CHECK(accepted_gap_qty >= 0),
  not_feasible_reason text, data_changed_since_acceptance boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(not_feasible_reason IS NULL OR length(trim(not_feasible_reason)) >= 10),
  CHECK(fulfilled_qty <= accepted_gap_qty)
);
CREATE UNIQUE INDEX one_live_requirement_per_school_resource ON requirements(school_id,resource_id) WHERE status <> 'CLOSED';
CREATE INDEX requirements_status_created_idx ON requirements(status,created_at);
CREATE TABLE interventions (
  intervention_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid NOT NULL REFERENCES requirements(requirement_id) ON DELETE RESTRICT,
  org_id uuid REFERENCES organizations(org_id) ON DELETE RESTRICT, action_description text NOT NULL,
  status_at_entry requirement_status NOT NULL, updated_by uuid REFERENCES users(user_id) ON DELETE RESTRICT, comments text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE feedback (
  feedback_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid NOT NULL REFERENCES requirements(requirement_id) ON DELETE RESTRICT,
  source feedback_source NOT NULL, confirmation feedback_confirmation, comments text, evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'SCHOOL' AND confirmation IS NOT NULL) OR (source <> 'SCHOOL' AND confirmation IS NULL))
);
CREATE TABLE audit_logs (
  log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type varchar(50) NOT NULL, entity_id uuid NOT NULL,
  action varchar(50) NOT NULL, performed_by uuid REFERENCES users(user_id) ON DELETE RESTRICT,
  old_value jsonb, new_value jsonb, performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_time_idx ON audit_logs(entity_type,entity_id,performed_at DESC);
CREATE TABLE refresh_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  token_hash varchar(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(token_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE requirement_status_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid NOT NULL REFERENCES requirements(requirement_id) ON DELETE RESTRICT,
  old_status requirement_status, new_status requirement_status NOT NULL, actor_id uuid REFERENCES users(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','schools','organizations','field_coordinator_schools','resource_categories','resources','assessments','school_resources','gap_records','weight_configs','priority_scores','requirements','interventions','feedback','audit_logs','refresh_tokens','requirement_status_events'] LOOP
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
