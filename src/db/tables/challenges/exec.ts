import { PoolClient } from "pg";
import { withDbClient, withTransaction } from "../../connector";
import QueryResultType, { QueryResponseError } from "../../queries";
import * as Chall from "./types";
import { DbChallengeMeta, QueryReturn } from "./types";
import UserQuery, { InsertChallenge, GetChallenge, GetAllChallenges } from "./queries";

type ChallengeRow = {
    id: Chall.Id;
    
    name: Chall.Name;
    description: Chall.Description;
    points: Chall.Points;

    authors: Chall.Authors;
    hints: Chall.Hints;
    categories: Chall.Categories;
    tags: Chall.Tags;

    solve_count: Chall.SolveCount;
    visible: Chall.Visible;
    source_folder: Chall.SourceFolder;
};

type LinkRow = {
    url: string;
    type: Chall.LinkType;
};

const linksFromLinkRows = (linkRows: LinkRow[]): Chall.Links => {
    const links: Chall.Links = {
        nc: [],
        web: [],
        admin: [],
        static: [],
    };

    for (const { url, type } of linkRows) {
        links[type].push(url);
    }

    return links;
}

const metaFromRowAndLinks = (row: ChallengeRow, links: LinkRow[]) => {
    const {
        id,
        name, description, points,
        authors, hints, categories, tags,
        solve_count, visible, source_folder,
    } = row;


    const challenge: DbChallengeMeta = {
        id,
        name, description, points,
        authors, hints, categories, tags, links: linksFromLinkRows(links),
        solve_count, visible, source_folder,
    };
    return challenge;
};

const getChallenge = async (client: PoolClient, id: Chall.Id, serverAtFault?: boolean): Promise<DbChallengeMeta> => {
    const getChallQuery = `
    SELECT
        id,
        name, description, points,
        authors, hints, categories, tags,
        solve_count, visible, source_folder
    FROM challenges WHERE id = $1;`;
    const getLinksQuery = `
    SELECT url, type FROM challenge_links WHERE challenge_id = $1;`;


    const getChallRes = await client.query<ChallengeRow, [Chall.Id]>(getChallQuery, [id]);
    if (getChallRes.rowCount !== 1) {
        if (serverAtFault) throw QueryResponseError.clientOther({ id }, 500, "Failed to retrieve challenge ID");
        else throw QueryResponseError.clientOther({ id }, 400, "Invalid Challenge ID");
    }

    const getLinksRes = await client.query<LinkRow, [Chall.Id]>(getLinksQuery, [id]);



    return metaFromRowAndLinks(getChallRes.rows[0], getLinksRes.rows);
};
const setChallUpdated = async (client: PoolClient, id: Chall.Id): Promise<void> => {
    const setChallUpdatedQuery = `
    UPDATE users
    SET updated_at = DEFAULT
    WHERE id = $1;`;

    await client.query<[], [Chall.Id]>(setChallUpdatedQuery, [id]);
};


export const execGetChallenge = withDbClient(async (client, input: GetChallenge): Promise<QueryReturn> => {
    const chall = await getChallenge(client, input.id);
    return { success: true, output: chall };
});

export const execGetAllChallenges = withTransaction(async (client, input: GetAllChallenges): Promise<QueryResultType<ChallengeRow[], QueryResponseError>> => {
    const getChallsQuery = `
    SELECT
        id,
        name, description, points,
        authors, hints, categories, tags,
        solve_count, visible, source_folder
    FROM challenges;`;
    const getLinksQuery = `
    SELECT url, type, challenge_id FROM challenge_links;`;

    const getChallRes = await client.query<ChallengeRow, []>(getChallsQuery, []);
    const getLinksRes = await client.query<LinkRow & { challenge_id: string }, []>(getLinksQuery, []);

    const challLinks: Partial<Record<string, LinkRow[]>> = {};
    for (const { url, type, challenge_id: cid } of getLinksRes.rows) {
        if (challLinks[cid]?.push({ url, type }) === undefined) {
            challLinks[cid] = [{ url, type }];
        }
    }


    const challs = getChallRes
        .rows
        .map(chall => [chall, challLinks[chall.id] ?? []] as const)
        .map(([chall, links]) => metaFromRowAndLinks(chall, links));

    return { success: true, output: challs };
});

export const execInsertChallenge = withTransaction(async (client, input: InsertChallenge): Promise<QueryReturn> => {
    type InsertChallengeInput = [
        Chall.Name, Chall.Description,
        string,
        Chall.Points, Chall.Authors, Chall.Hints, Chall.Categories, Chall.Tags,
        Chall.Visible, Chall.SourceFolder,
    ];
    const challengeCreateQuery = `
    INSERT INTO challenges (
        name, description,
        flag,
        points,
        authors, hints, categories, tags,
        visible, source_folder
    ) VALUES (
        $1, $2,
        $3,
        $4,
        $5, $6, $7, $8,
        $9, $10
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

        visible = EXCLUDED.visible,
        source_folder = EXCLUDED.source_folder;`;

    type GetChallengeIdQueryRow = { id: Chall.Id };
    const getChallengeIdQuery = `
    SELECT id FROM challenges WHERE source_folder = $1;`;

    type SetLinksInput = [Chall.Id, string[], string[], string[], string[]];
    const setChallengeLinksQuery = `
    SELECT replace_challenge_links($1, $2, $3, $4, $5)`;




    await client.query<[], InsertChallengeInput>(
        challengeCreateQuery,
        [
            input.name, input.description,
            input.flag,
            input.points, input.authors, input.hints, input.categories, input.tags,
            input.visible ?? true, input.source_folder,
        ],
    );
    const getChallIdRes = await client.query<GetChallengeIdQueryRow, [Chall.SourceFolder]>(getChallengeIdQuery, [input.source_folder]);
    if (getChallIdRes.rowCount !== 1) throw QueryResponseError.server(input, 500, "Unable to find newly-created user");
    const id = getChallIdRes.rows[0].id;

    const { web, nc, admin, static: static_links } = linksFromLinkRows(input.links.map(([type, url]) => ({ type, url })));
    await client.query<[], SetLinksInput>(
        setChallengeLinksQuery,
        [id, web, nc, admin, static_links], // THIS ORDER IS VERY IMPORTANT
    );

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
