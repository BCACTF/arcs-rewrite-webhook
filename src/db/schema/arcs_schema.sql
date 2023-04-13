CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';

CREATE TYPE challenge_type AS ENUM (
    'misc',
    'binex',
    'crypto',
    'foren',
    'rev',
    'webex'
);

-- CREATE TYPE user_type AS ENUM (
--     'default',
--     'eligible',
--     'admin'
-- );

CREATE TABLE challenges (
    id uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
    name citext NOT NULL UNIQUE,

    description text NOT NULL,
    flag varchar(255) NOT NULL,
    points integer NOT NULL,

    authors varchar(255)[],
    hints varchar(255)[],
    categories challenge_type[],
    tags varchar(255)[] NOT NULL,
    links jsonb,

    solve_count integer DEFAULT 0 NOT NULL,

    visible boolean DEFAULT true NOT NULL,
    source_folder varchar(255) NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE schema_migrations (
    version uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
    inserted_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE solve_attempts (
    id uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),

    flag_guess varchar(255) NOT NULL,
    correct boolean DEFAULT false NOT NULL,

    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    team_id uuid NOT NULL,

    inserted_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE solve_successes (
    id uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),

    attempt_id uuid NOT NULL,

    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    team_id uuid NOT NULL,

    solved_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE team_stats (
    id uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),

    score integer,
    team_id uuid,
    inserted_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE teams (
    id uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
    name citext NOT NULL UNIQUE,

    description text NOT NULL,

    score integer DEFAULT 0 NOT NULL,
    last_solve timestamp(0) without time zone,

    eligible boolean DEFAULT false NOT NULL,
    affiliation varchar(255),

    hashed_password varchar(255),
    inserted_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE users (
    id uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),
    email citext NOT NULL UNIQUE,
    name citext NOT NULL UNIQUE,

    team_id uuid,
    score integer DEFAULT 0,
    last_solve timestamp(0) without time zone,


    eligible boolean DEFAULT false NOT NULL,
    admin boolean DEFAULT false NOT NULL,

    hashed_password varchar(255) NOT NULL,

    inserted_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at timestamp(0) without time zone
);


CREATE TABLE users_tokens (
    id uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4(),

    user_id uuid NOT NULL,
    token bytea NOT NULL,
    context varchar(255) NOT NULL,
    sent_to varchar(255),
    inserted_at timestamp(0) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX solves_chalid_idx ON solve_attempts USING btree (challenge_id);
CREATE INDEX solves_teamid_idx ON solve_attempts USING btree (team_id);
CREATE INDEX solves_userid_idx ON solve_attempts USING btree (user_id);


CREATE INDEX solve_succ_attemptid_idx ON solve_successes USING btree (user_id);
CREATE INDEX solve_succ_chalid_idx ON solve_successes USING btree (challenge_id);
CREATE INDEX solve_succ_teamid_idx ON solve_successes USING btree (team_id);
CREATE INDEX solve_succ_userid_idx ON solve_successes USING btree (user_id);


CREATE INDEX teamstats_teamid_idx ON team_stats USING btree (team_id);

CREATE UNIQUE INDEX user_name_idx ON users USING btree (name);
CREATE UNIQUE INDEX user_email_idx ON users USING btree (email);

CREATE UNIQUE INDEX teams_name_idx ON teams USING btree (name);

CREATE UNIQUE INDEX userstoken_context_token_idx ON users_tokens USING btree (context, token);
CREATE INDEX usertoken_userid_idx ON users_tokens USING btree (user_id);




ALTER TABLE ONLY solve_attempts ADD
    CONSTRAINT fkey_u_chalid FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;
ALTER TABLE ONLY solve_attempts ADD
    CONSTRAINT fkey_u_teamid FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE ONLY solve_attempts ADD
    CONSTRAINT fkey_u_userid FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ONLY solve_successes ADD
    CONSTRAINT fkey_attempt FOREIGN KEY (attempt_id) REFERENCES solve_attempts(id) ON DELETE CASCADE;

ALTER TABLE ONLY team_stats ADD
    CONSTRAINT fkey_ts_teamid FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

ALTER TABLE ONLY users_tokens
    ADD CONSTRAINT fkey_ut_userid FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;