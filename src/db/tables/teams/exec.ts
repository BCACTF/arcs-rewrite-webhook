import { PoolClient } from "pg";
import { db, withDbClient, withTransaction } from "../../connector";
import { createHash, verifyHash } from "../../passwords";
import QueryResultType, { QueryResponseError } from "../../queries";
import { Affiliation, Description, Eligible, HashedPassword, Id, LastSolve, Name, Score } from "./types";
import { DbTeamMeta, QueryReturn } from "./types";
import TeamQuery, { CheckTeamnameAvailability, CreateNewTeam, GetAllTeams, GetTeam, UpdateTeam } from "./queries";
import * as log from '../../../logging';

type TeamRow = { id: Id, name: Name, description: Description, score: Score, last_solve: LastSolve, eligible: Eligible, affiliation: Affiliation };

const metaFromRow = (row: TeamRow) => {
    const {
        name, score, eligible, affiliation, description,
        id: teamId, last_solve: rawLastSolve,
    } = row; 
    const lastSolve = rawLastSolve ? rawLastSolve.getTime() / 1000 : null;

    const team: DbTeamMeta = {
        id: teamId, last_solve: lastSolve,
        name, score, eligible, affiliation, description,
    };
    return team;
};

const getTeam = async (client: PoolClient, id: Id, serverAtFault?: boolean): Promise<DbTeamMeta> => {
    log.trace`Getting team with id ${id}.`;

    const getTeamQuery = `
    SELECT
        id, name, description, score,
        last_solve, eligible, affiliation
    FROM teams WHERE id = $1;`;

    const getTeamRes = await client.query<TeamRow, [Id]>(getTeamQuery, [id]);

    if (getTeamRes.rowCount !== 1) {


        if (serverAtFault) {
            log.error`Failed to find team with id ${id}.`;
            throw QueryResponseError.clientOther({ id }, 500, "Failed to retrieve Team");
        } else {
            log.warn`Failed to find team with id ${id}.`;
            throw QueryResponseError.clientOther({ id }, 400, "Invalid Team ID");
        }
    }
    const teamRow = getTeamRes.rows[0];

    log.warn`${id} identified as ${teamRow.name}.`;

    return metaFromRow(teamRow);
};
export const confirmTeamPasswordValid = async (client: PoolClient, id: Id, password: HashedPassword): Promise<string> => {
    type GetTeamPasswordRow = { hashed_password: HashedPassword };
    const getTeamPasswordQuery = `
    SELECT hashed_password
    FROM teams
    WHERE id = $1;`;

    const getTeamPasswordRes = await client.query<GetTeamPasswordRow, [Id]>(getTeamPasswordQuery, [id]);
    if (getTeamPasswordRes.rowCount !== 1) throw QueryResponseError.clientOther({ id }, 400, "Team ID does not exist");

    const hash = getTeamPasswordRes.rows[0].hashed_password;

    if (await verifyHash(password, hash)) return hash;
    else throw QueryResponseError.clientUnauth({ id }, 401, "Invalid Password");
};
export const setTeamUpdated = async (client: PoolClient, id: Id): Promise<void> => {
    const setTeamUpdatedQuery = `
    UPDATE teams
    SET last_updated = DEFAULT
    WHERE id = $1;`;

    await client.query<[], [Id]>(setTeamUpdatedQuery, [id]);
};


export const execGetTeam = withDbClient(async (client, input: GetTeam): Promise<QueryReturn> => {
    try {
        const team = await getTeam(client, input.id);
        return { success: true, output: team };
    } catch (e) {
        return {
            success: false,
            error: QueryResponseError.wrap(e),
        };
    }
});

export const execGetAllTeams = withDbClient(async (client, input: GetAllTeams): Promise<QueryResultType<DbTeamMeta[], QueryResponseError>> => {
    try {
        const getTeamQuery = `
        SELECT
            id, name, description, score,
            last_solve, eligible, affiliation
        FROM teams;`;
    
        const getTeamRes = await client.query<TeamRow, []>(getTeamQuery, []);
        const teams = getTeamRes.rows.map(metaFromRow);

        return { success: true, output: teams };
    } catch (e) {
        return {
            success: false,
            error: QueryResponseError.wrap(e),
        };
    }
});

export const execCreateTeam = withTransaction(async (client, input: CreateNewTeam): Promise<QueryReturn> => {
    log.trace`Recieved request to create team ${input.name}.`;


    type TeamCreateQueryInput = [Name, Eligible, Affiliation, HashedPassword];
    const teamCreateQuery = `
    INSERT INTO teams (
        name, description, eligible, affiliation,
        hashed_password
    ) VALUES ($1, '', $2, $3, $4);`;
    type GetTeamIdQueryOutput = { id: Id };
    const getTeamIdQuery = `
    SELECT id FROM teams WHERE name = $1;`;
    const initFirstUser = `
    UPDATE users
    SET team_id = $1
    WHERE id = $2;`;



    await client.query<[], TeamCreateQueryInput>(
        teamCreateQuery,
        [input.name, input.eligible, input.affiliation, await createHash(input.password)],
    );

    log.trace`Create team query run.`;

    const getTeamIdRes = await client.query<GetTeamIdQueryOutput, [Name]>(getTeamIdQuery, [input.name]);
    if (getTeamIdRes.rowCount !== 1) {
        log.error`Failed to find team ${input.name} supposedly created!`;
        throw QueryResponseError.server(input, 500, "Unable to find newly-created team");
    }
    const id = getTeamIdRes.rows[0].id;

    log.debug`Team ${input.name} is ${id}`;
    
    await client.query(initFirstUser, [id, input.initialUser]);
    
    log.error`User ${input.initialUser} added to ${input.name}`;

    return { success: true, output: await getTeam(client, id) };
});

export const execCheckTeamnameAvailable = withTransaction(async (
    client,
    input: CheckTeamnameAvailability,
): Promise<QueryResultType<boolean, QueryResponseError>> => {
    const checkQuery = "SELECT COUNT(*) as count from teams WHERE name = $1;";

    const queryRes = await client.query<{ count: unknown }, [string]>(
        checkQuery,
        [ input.name ],
    );
    const count = Number(queryRes.rows[0].count);

    if (Number.isNaN(count) || count !== 0) return { success: true, output: false };
    else return { success: true, output: true };
});

export const execUpdateTeamMeta = withTransaction(async (client, input: UpdateTeam): Promise<QueryReturn> => {
    const updateQuery = `
    UPDATE teams
    SET
        name = $2,
        eligible = $3,
        affiliation = $4,
        description = $5,
        hashed_password = $6
    WHERE id = $1;`;

    
    const hash = await confirmTeamPasswordValid(client, input.id, input.password);
    const updatedHash = input.password === input.newPassword || !input.newPassword ? hash : await createHash(input.newPassword);

    await client.query(updateQuery, [
        input.id,
        input.name, input.eligible, input.affiliation, input.description,
        updatedHash,
    ]);
    await setTeamUpdated(client, input.id);
    
    return { success: true, output: await getTeam(client, input.id) };
});

const execTeamQuery = async (query: TeamQuery): Promise<QueryResultType<unknown, QueryResponseError>> => {
    switch (query.query.__tag) {
        case "available":
            return await execCheckTeamnameAvailable(query.query);
        case "create":
            return await execCreateTeam(query.query);
        case "update":
            return await execUpdateTeamMeta(query.query);
        case "get":
            return await execGetTeam(query.query);
        case "get_all":
            return await execGetAllTeams(query.query);
    }
};

export default execTeamQuery;
