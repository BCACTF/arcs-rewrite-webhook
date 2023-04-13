import { PoolClient } from "pg";
import { db, withDbClient, withTransaction } from "../../connector";
import { createHash, verifyHash } from "../../passwords";
import QueryResultType, { QueryResponseError } from "../../queries";
import * as Chall from "./types";
import { DbChallengeMeta, QueryReturn } from "./types";
import UserQuery, { InsertChallenge, GetChallenge, GetAllChallenges } from "./queries";
import { confirmTeamPasswordValid, setTeamUpdated } from "../teams/exec";

type ChallengeRow = {
    id: Chall.Id;
    
    name: Chall.Name;
    description: Chall.Description;
    points: Chall.Points;

    authors: Chall.Authors;
    hints: Chall.Hints;
    categories: Chall.Categories;
    tags: Chall.Tags;
    links: Chall.Links;

    solve_count: Chall.SolveCount;
    visible: Chall.Visible;
    source_folder: Chall.SourceFolder;
};

const metaFromRow = (row: ChallengeRow) => {
    const {
        id,
        name, description, points,
        authors, hints, categories, tags, links,
        solve_count, visible, source_folder,
    } = row; 

    const challenge: DbChallengeMeta = {
        id,
        name, description, points,
        authors, hints, categories, tags, links,
        solve_count, visible, source_folder,
    };
    return challenge;
};

const getChallenge = async (client: PoolClient, id: Chall.Id, serverAtFault?: boolean): Promise<DbChallengeMeta> => {
    const getChallQuery = `
    SELECT
        id,
        name, description, points,
        authors, hints, categories, tags, links,
        solve_count, visible, source_folder
    FROM challenges WHERE id = $1;`;

    const getChallRes = await client.query<ChallengeRow, [Chall.Id]>(getChallQuery, [id]);
    if (getChallRes.rowCount !== 1) {
        if (serverAtFault) throw QueryResponseError.clientOther({ id }, 500, "Failed to retrieve challenge ID");
        else throw QueryResponseError.clientOther({ id }, 400, "Invalid Challenge ID");
    }
    return metaFromRow(getChallRes.rows[0]);
};
const setChallUpdated = async (client: PoolClient, id: Chall.Id): Promise<void> => {
    const setChallUpdatedQuery = `
    UPDATE users
    SET updated_at = DEFAULT
    WHERE id = $1;`;

    await client.query<[], [Chall.Id]>(setChallUpdatedQuery, [id]);
};


export const execGetChallenge = withDbClient(async (client, input: GetChallenge): Promise<QueryReturn> => {
    try {
        const chall = await getChallenge(client, input.id);
        return { success: true, output: chall };
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

export const execGetAllChallenges = withDbClient(async (client, input: GetAllChallenges): Promise<QueryResultType<ChallengeRow[], QueryResponseError>> => {
    try {
        const getChallsQuery = `
        SELECT
            id,
            name, description, points,
            authors, hints, categories, tags, links,
            solve_count, visible, source_folder
        FROM challenges;`;
    
        const getChallRes = await client.query<ChallengeRow, []>(getChallsQuery, []);
        const challs = getChallRes.rows.map(metaFromRow);

        return { success: true, output: challs };
    } catch (e) {
        return {
            success: false,
            error: QueryResponseError.wrap(e),
        };
    }
});

export const execInsertChallenge = withTransaction(async (client, input: InsertChallenge): Promise<QueryReturn> => {
    type InsertChallengeInput = [
        Chall.Name, Chall.Description,
        string,
        Chall.Points, Chall.Authors, Chall.Hints, Chall.Categories, Chall.Tags, unknown,
        Chall.Visible, Chall.SourceFolder,
    ];
    const challengeCreateQuery = `
    INSERT INTO challenges (
        name, description,
        flag,
        points,
        authors, hints, categories, tags, links,
        visible, source_folder
    ) VALUES (
        $1, $2,
        $3,
        $4,
        $5, $6, $7, $8, $9,
        $10, $11
    )
    ON CONFLICT (source_folder)
    DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        flag = EXCLUDED.flag,
        points = EXCLUDED.points,

        authors = EXCLUDED.authors,
        hints = EXCLUDED.hints,
        categories = EXCLUDED.categories,
        tags = EXCLUDED.tags,
        links = EXCLUDED.links,

        visible = EXCLUDED.visible,
        source_folder = EXCLUDED.source_folder;`;

    type GetUserIdQueryRow = { id: Chall.Id };
    const getChallengeIdQuery = `
    SELECT id FROM challenges WHERE source_folder = $1;`;



    await client.query<[], InsertChallengeInput>(
        challengeCreateQuery,
        [
            input.name, input.description,
            input.flag,
            input.points, input.authors, input.hints, input.categories, input.tags, input.links,
            input.visible ?? true, input.source_folder,
        ],
    );


    const getChallIdRes = await client.query<GetUserIdQueryRow, [Chall.SourceFolder]>(getChallengeIdQuery, [input.source_folder]);
    if (getChallIdRes.rowCount !== 1) throw QueryResponseError.server(input, 500, "Unable to find newly-created user");
    console.log(getChallIdRes);
    const id = getChallIdRes.rows[0].id;

    return { success: true, output: await getChallenge(client, id) };
});

const execChallengeQuery = async (query: UserQuery): Promise<QueryResultType<unknown, QueryResponseError>> => {
    switch (query.query.__tag) {
        case "create":
            return await execInsertChallenge(query.query);
        case "get":
            return await execGetChallenge(query.query);
        case "get_all":
            return await execGetAllChallenges(query.query);
    }
};

export default execChallengeQuery;
