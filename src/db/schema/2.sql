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


ALTER TABLE ONLY solve_attempts ADD
    CONSTRAINT fkey_u_chalid FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;
ALTER TABLE ONLY solve_attempts ADD
    CONSTRAINT fkey_u_teamid FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE ONLY solve_attempts ADD
    CONSTRAINT fkey_u_userid FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


ALTER TABLE ONLY solve_successes ADD
    CONSTRAINT fkey_attempt FOREIGN KEY (attempt_id) REFERENCES solve_attempts(id) ON DELETE CASCADE;
ALTER TABLE ONLY solve_successes ADD
    CONSTRAINT fkey_u_chalid FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;
ALTER TABLE ONLY solve_successes ADD
    CONSTRAINT fkey_u_teamid FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE ONLY solve_successes ADD
    CONSTRAINT fkey_u_userid FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;



CREATE INDEX solves_chalid_idx ON solve_attempts USING btree (challenge_id);
CREATE INDEX solves_teamid_idx ON solve_attempts USING btree (team_id);
CREATE INDEX solves_userid_idx ON solve_attempts USING btree (user_id);



CREATE UNIQUE INDEX solve_succ_attemptid_idx ON solve_successes USING btree (user_id);
CREATE INDEX solve_succ_chalid_idx ON solve_successes USING btree (challenge_id);
CREATE INDEX solve_succ_teamid_idx ON solve_successes USING btree (team_id);
CREATE INDEX solve_succ_userid_idx ON solve_successes USING btree (user_id);

CREATE UNIQUE INDEX solve_succ_scoring_limit_idx ON solve_successes USING btree (challenge_id, team_id);

