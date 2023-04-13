import { PoolClient } from "pg";
import { db, withDbClient, withTransaction } from "../../connector";
import { createHash, verifyHash } from "../../passwords";
import QueryResultType, { QueryResponseError } from "../../queries";
import {
    Id, Email, Name, TeamId, Score, LastSolve, Eligible, Admin,
    HashedPassword,
} from "./types";
import { DbUserMeta, QueryReturn } from "./types";
import UserQuery, { CreateNewUser, UpdateUserNamePass, UserJoinTeam, GetUser, GetAllUsers } from "./queries";
import { confirmTeamPasswordValid, setTeamUpdated } from "../teams/exec";

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
export const confirmUserPasswordValid = async (client: PoolClient, id: Id, password: HashedPassword): Promise<string> => {
    type GetUserPasswordRow = { hashed_password: HashedPassword };
    const getUserPasswordQuery = `
    SELECT hashed_password
    FROM users
    WHERE id = $1;`;

    const getUserPasswordRes = await client.query<GetUserPasswordRow, [Id]>(getUserPasswordQuery, [id]);
    if (getUserPasswordRes.rowCount !== 1) throw QueryResponseError.clientOther({ id }, 400, "User ID does not exist");

    const hash = getUserPasswordRes.rows[0].hashed_password;

    if (await verifyHash(password, hash)) return hash;
    else throw QueryResponseError.clientUnauth({ id }, 401, "Invalid Password");
};
const setUserUpdated = async (client: PoolClient, id: Id): Promise<void> => {
    const setUserUpdatedQuery = `
    UPDATE users
    SET updated_at = DEFAULT
    WHERE id = $1;`;

    await client.query<[], [Id]>(setUserUpdatedQuery, [id]);
};
const getOptUpdatedPasswordHash = async (oldPass: string, oldPassHash: string, newPass: string | null) => {
    if (!newPass || newPass === oldPass) return oldPassHash;
    else return await createHash(newPass);
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
    type UserCreateQueryInput = [Email, Name, HashedPassword, Admin, Eligible];
    const userCreateQuery = `
    INSERT INTO users (
        email, name, hashed_password, admin, eligible
    ) VALUES ($1, $2, $3, $4, $5);`;

    type GetUserIdQueryRow = { id: Id };
    const getUserIdQuery = `
    SELECT id FROM users WHERE name = $1;`;



    await client.query<[], UserCreateQueryInput>(
        userCreateQuery,
        [input.email, input.name, await createHash(input.password), false, input.eligible],
    );


    const getUserIdRes = await client.query<GetUserIdQueryRow, [Name]>(getUserIdQuery, [input.name]);
    if (getUserIdRes.rowCount !== 1) throw QueryResponseError.server(input, 500, "Unable to find newly-created user");
    console.log(getUserIdRes);
    const id = getUserIdRes.rows[0].id;

    return { success: true, output: await getUser(client, id) };
});


export const execUpdateUserNamePass = withTransaction(async (client, input: UpdateUserNamePass): Promise<QueryReturn> => {
    type UpdateUserNamePass = [Id, Name, HashedPassword, Eligible];
    const updateQuery = `
    UPDATE users
    SET
        name = $2,
        hashed_password = $3,
        eligible = $4
    WHERE id = $1;`;

    
    const hash = await confirmUserPasswordValid(client, input.id, input.password);
    const updatedHash = await getOptUpdatedPasswordHash(input.password, hash, input.newPassword);

    await client.query<[], UpdateUserNamePass>(updateQuery, [
        input.id,
        input.name, updatedHash, input.eligible
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
        confirmUserPasswordValid(client, input.id, input.password),
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
