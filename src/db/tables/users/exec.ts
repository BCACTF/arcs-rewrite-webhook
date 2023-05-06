import { PoolClient } from "pg";
import { db, withDbClient, withTransaction } from "../../connector";
import { createHash, verifyHash } from "../../passwords";
import QueryResultType, { QueryResponseError } from "../../queries";
import {
    Id, Email, Name, TeamId, Score, LastSolve, Eligible, Admin,
    Auth,
} from "./types";
import { DbUserMeta, QueryReturn } from "./types";
import UserQuery, { CreateNewUser, UpdateUserNamePass, UserJoinTeam, GetUser, GetAllUsers, CheckUserAuth } from "./queries";
import { confirmTeamPasswordValid, setTeamUpdated } from "../teams/exec";
import { checkOauthClientAllowed } from "../../../security/incoming-req";

type UserRow = {
    id: Id,
    email: Email, name: Name,
    team_id: TeamId, score: Score, last_solve: LastSolve,
    eligible: Eligible, admin: Admin,
};

const metaFromRow = (row: UserRow) => {
    const {
        id: userId, team_id: teamId, last_solve: rawLastSolve,
        email, name, score, eligible, admin
    } = row; 
    const lastSolve = rawLastSolve ? rawLastSolve.getTime() / 1000 : null;

    const user: DbUserMeta = {
        id: userId, email, name,
        team_id: teamId, score,
        last_solve: lastSolve,
        eligible: !admin && eligible,
        admin,
    };
    return user;
};

const getUser = async (client: PoolClient, id: Id, serverAtFault?: boolean): Promise<DbUserMeta> => {
    const getUserQuery = `
    SELECT
        id,
        email, name,
        team_id, score, last_solve,
        eligible, admin
    FROM users WHERE id = $1;`;

    const getUserRes = await client.query<UserRow, [Id]>(getUserQuery, [id]);
    if (getUserRes.rowCount !== 1) {
        if (serverAtFault) throw QueryResponseError.clientOther({ id }, 500, "Failed to retrieve user ID");
        else throw QueryResponseError.clientOther({ id }, 400, "Invalid User ID");
    }
    return metaFromRow(getUserRes.rows[0]);
};

type UserAuthCheckReturn = "not_found" | "bad_auth" | "authenticated";
export const confirmUserAuthValid = async (client: PoolClient, id: Id, auth: Auth): Promise<void> => {
    if (auth.__type === "pass") {
        type GetPassRow = { hash: string };
        const getPassQuery = `SELECT get_signin($1) as hash;`;

        const getPassRes = await client.query<GetPassRow, [Id]>(getPassQuery, [id]);
        if (getPassRes.rowCount !== 1) throw QueryResponseError.clientOther({ id }, 400, "User ID does not exist");

        const hash = getPassRes.rows[0].hash;

        if (await verifyHash(auth.password, hash)) return;
        else throw QueryResponseError.clientUnauth({ id }, 401, "Invalid Password");
    } else {
        if (!checkOauthClientAllowed(auth.trustedClientAuth)) throw QueryResponseError.clientOther(
            { id },
            403,
            "Client is not allowed to validate using oath tokens",
        );

        type TryOauthRow = { result: UserAuthCheckReturn };
        type TryOauthInput = [ Id, string, string ];
        const getPassQuery = `SELECT try_signin_oauth($1, $2, $3) as result;`;

        const tryOauthRes = await client.query<TryOauthRow, TryOauthInput>(getPassQuery, [id, auth.sub, auth.provider]);
        const result = tryOauthRes.rows[0].result;
        if (result === "not_found") throw QueryResponseError.clientOther(
            { id },
            400,
            "User ID does not exist or does not use this authentication provider.",
        );
        if (result === "bad_auth") throw QueryResponseError.clientUnauth({ id }, 401, "Invalid Oauth Sub");
    }
};
const setUserUpdated = async (client: PoolClient, id: Id): Promise<void> => {
    const setUserUpdatedQuery = `
    UPDATE users
    SET updated_at = DEFAULT
    WHERE id = $1;`;

    await client.query<[], [Id]>(setUserUpdatedQuery, [id]);
};


export const execGetUser = withDbClient(async (client, input: GetUser): Promise<QueryReturn> => {
    try {
        const team = await getUser(client, input.id);
        return { success: true, output: team };
    } catch (e) {
        if (e instanceof QueryResponseError) return {
            success: false,
            error: e,
        };
        else {
            return {
                success: false,
                error: QueryResponseError.wrap(new Error("Unknown server error")),
            };
        }
    }
});

export const execGetAllUsers = withDbClient(async (client, input: GetAllUsers): Promise<QueryResultType<DbUserMeta[], QueryResponseError>> => {
    try {
        const getUserQuery = `
        SELECT
            id,
            email, name,
            team_id, score, last_solve,
            eligible, admin
        FROM users;`;
    
        const getUserRes = await client.query<UserRow, []>(getUserQuery, []);
        const users = getUserRes.rows.map(metaFromRow);

        return { success: true, output: users };
    } catch (e) {
        return {
            success: false,
            error: QueryResponseError.wrap(e),
        };
    }
});

export const execCreateUser = withTransaction(async (client, input: CreateNewUser): Promise<QueryReturn> => {
    type UserCreateQueryInput = [Email, Name, Admin, Eligible];
    const userCreateQuery = `
    INSERT INTO users (
        email, name, admin, eligible
    ) VALUES ($1, $2, $3, $4, $5);`;

    type GetUserIdQueryRow = { id: Id };
    const getUserIdQuery = `
    SELECT id FROM users WHERE name = $1;`;



    await client.query<[], UserCreateQueryInput>(
        userCreateQuery,
        [input.email, input.name, false, input.eligible],
    );
    const getUserIdRes = await client.query<GetUserIdQueryRow, [Name]>(getUserIdQuery, [input.name]);

    if (getUserIdRes.rowCount !== 1) throw QueryResponseError.server(input, 500, "Unable to find newly-created user");
    // console.log(getUserIdRes);
    const id = getUserIdRes.rows[0].id;

    if (input.auth.__type === "pass") {
        type CreatePassHashMethodInput = [ Id, string ];
        const createPassHashMethodQuery = `
        INSERT INTO auth_name_pass ( user_id, hashed_password )
        VALUES ( $1, $2 );`;

        await client.query<Record<string, never>, CreatePassHashMethodInput>(
            createPassHashMethodQuery,
            [ id, await createHash(input.auth.password) ],
        );
    } else {
        if (!checkOauthClientAllowed(input.auth.trustedClientAuth)) throw QueryResponseError.clientOther(
            { id },
            403,
            "Client is not allowed to validate using oath tokens",
        );

        type CreateOauthMethodInput = [ Id, string, string ];
        const createOauthMethodQuery = `
        INSERT INTO auth_oauth ( user_id, sub, provider_name )
        VALUES ( $1, $2, $3 );`;

        await client.query<Record<string, never>, CreateOauthMethodInput>(
            createOauthMethodQuery,
            [ id, input.auth.sub, input.auth.provider ],
        );
    }

    return { success: true, output: await getUser(client, id) };
});


export const execCheckAuth = withTransaction(async (client, input: CheckUserAuth): Promise<QueryResultType<boolean, QueryResponseError>> => {
    try {
        await confirmUserAuthValid(client, input.id, input.auth);
        return { success: true, output: true };
    } catch (e) {
        if (e instanceof QueryResponseError && e.getStatusCode() === 401) {
            return { success: true, output: true };
        } else throw e;
    }
});

export const execUpdateUserNamePass = withTransaction(async (client, input: UpdateUserNamePass): Promise<QueryReturn> => {
    type UpdateUserName = [Id, Name, Eligible];
    const updateQuery = `
    UPDATE users
    SET
        name = $2,
        eligible = $3
    WHERE id = $1;`;

    
    await confirmUserAuthValid(client, input.id, input.auth);

    await client.query<[], UpdateUserName>(updateQuery, [
        input.id,
        input.name, input.eligible
    ]);
    await setUserUpdated(client, input.id);
    
    return { success: true, output: await getUser(client, input.id) };
});

export const execUserJoinTeam = withTransaction(async (client, input: UserJoinTeam): Promise<QueryReturn> => {
    type UserJoinTeam = [Id, string];
    const updateUserTeamQuery = `
    UPDATE users
    SET teamId = $2
    WHERE id = $1;`;
    type TeamEligibility = [Id, Eligible];
    const updateTeamEligibilityQuery = `
    UPDATE teams
    SET eligible = false
    WHERE id = $1 AND $2 IS FALSE;`;

    
    await Promise.all([
        confirmUserAuthValid(client, input.id, input.auth),
        confirmTeamPasswordValid(client, input.teamId, input.teamPassword),
    ]);

    await client.query<[], UserJoinTeam>(updateUserTeamQuery, [input.id, input.teamId]);
    await setUserUpdated(client, input.id);
    
    const user = await getUser(client, input.id);
    
    await client.query<[], TeamEligibility>(updateTeamEligibilityQuery, [input.teamId, user.eligible]);
    await setTeamUpdated(client, input.teamId);
    
    return { success: true, output: user };
});

const execUserQuery = async (query: UserQuery): Promise<QueryResultType<unknown, QueryResponseError>> => {
    switch (query.query.__tag) {
        case "create":
            return await execCreateUser(query.query);
        case "auth":
            return await execCheckAuth(query.query);
        case "update":
            return await execUpdateUserNamePass(query.query);
        case "join":
            return await execUserJoinTeam(query.query);
        case "get":
            return await execGetUser(query.query);
        case "get_all":
            return await execGetAllUsers(query.query);
    }
};

export default execUserQuery;
