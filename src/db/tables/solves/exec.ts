import { PoolClient } from "pg";
import { withDbClient, withTransaction } from "../../connector";
import QueryResultType, { QueryResponseError } from "../../queries";
import * as Solve from "./types";
import { DbSolveMeta, QueryReturn } from "./types";
import SolveQuery, { GetAllSolves, GetChallengeSolves, GetTeamSolves, GetUserSolves, SubmitAttempt } from "./queries";

type SolveRow = {
    id: Solve.Id;

    user_id: Solve.Id;
    team_id: Solve.Id;
    challenge_id: Solve.Id;

    correct: boolean;
    counted: boolean;

    timestamp: Date;
};


const metaFromRow = (row: SolveRow) => {
    const {
        id, user_id, team_id, challenge_id,
        correct, counted, timestamp,
    } = row;


    const solve: DbSolveMeta = {
        id, user_id, team_id, challenge_id,
        correct, counted, timestamp: timestamp.getTime() / 1000,
    };
    return solve;
};

const getSolvesByPred = async (
    client: PoolClient,
    predicate: { query: string, value: unknown },
): Promise<DbSolveMeta[]> => {
    console.trace("SPOT 1");
    const getSolvesQuery = `
    SELECT
        solve_attempts.id,
        solve_attempts.user_id, solve_attempts.team_id, solve_attempts.challenge_id,
        correct, inserted_at as timestamp,
        (COUNT(solved_at) > 0) as counted
    FROM solve_attempts
    LEFT JOIN solve_successes ON solve_attempts.id = attempt_id
    WHERE ${predicate.query} GROUP BY solve_attempts.id ORDER BY timestamp;`;

    console.log(getSolvesQuery);
    console.log(predicate.value ? [predicate.value] : []);

    const getSolvesRes = await client.query<SolveRow, [unknown] | []>(
        getSolvesQuery,
        predicate.value ? [predicate.value] : [],
    );
    console.trace("SPOT 2");

    return getSolvesRes.rows.map(metaFromRow);
};

export const execSubmitAttempt = withTransaction(async (client, input: SubmitAttempt): Promise<QueryResultType<DbSolveMeta, QueryResponseError>> => {
    type SubmitInput = [Solve.Id, Solve.Id, Solve.Id, string];
    const submitChallAttemptQuery = `SELECT id FROM do_solve_attempt($1, $2, $3, $4) as (id uuid, g_c bool, a_s bool);`;

    const { user_id, team_id, challenge_id, flag } = input;

    const getLinksRes = await client.query<{ id: string }, SubmitInput>(
        submitChallAttemptQuery,
        [user_id, team_id, challenge_id, flag],
    );

    const solveSubmission = await getSolvesByPred(client, { query: "solve_attempts.id = $1", value: getLinksRes.rows[0].id });
    if (solveSubmission.length !== 1) {
        throw QueryResponseError.server(input, 500, "Unable to find new solve submission");
    }

    return { success: true, output: solveSubmission[0] };
});

export const execGetAllSolves = withTransaction(async (client, input: GetAllSolves): Promise<QueryResultType<DbSolveMeta[], QueryResponseError>> => {
    const solves = await getSolvesByPred(client, { query: "true", value: undefined });
    return { success: true, output: solves };
});
export const execGetUserSolves = withTransaction(async (client, input: GetUserSolves): Promise<QueryResultType<DbSolveMeta[], QueryResponseError>> => {
    const solves = await getSolvesByPred(client, { query: "solve_attempts.user_id = $1", value: input.id });
    return { success: true, output: solves };
});
export const execGetTeamSolves = withTransaction(async (client, input: GetTeamSolves): Promise<QueryResultType<DbSolveMeta[], QueryResponseError>> => {
    const solves = await getSolvesByPred(client, { query: "solve_attempts.team_id = $1", value: input.id });
    return { success: true, output: solves };
});
export const execGetChallengeSolves = withTransaction(async (client, input: GetChallengeSolves): Promise<QueryResultType<DbSolveMeta[], QueryResponseError>> => {
    const solves = await getSolvesByPred(client, { query: "solve_attempts.challenge_id = $1", value: input.id });
    return { success: true, output: solves };
});

const execSolveQuery = async (query: SolveQuery): Promise<QueryResultType<unknown, QueryResponseError>> => {
    switch (query.query.__tag) {
        case "submit":
            return await execSubmitAttempt(query.query);

        case "get_user":
            return await execGetUserSolves(query.query);
        case "get_team":
            return await execGetTeamSolves(query.query);
        case "get_challenge":
            return await execGetChallengeSolves(query.query);

        case "get_all":
            return await execGetAllSolves(query.query);
    }
};

export default execSolveQuery;
