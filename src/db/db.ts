import { db } from "./connector"
import QueryResultType, { QueryResponseError } from "./queries";
import execTeamQuery from "./tables/teams/exec";
import TeamQuery, { isValidTeamQuery } from "./tables/teams/queries";
import execUserQuery from "./tables/users/exec";
import UserQuery, { isValidUserQuery } from "./tables/users/queries";

// async function genClient(db: Pool) {
//     let client = await db.connect()
//     return client;
// }

type Query = TeamQuery | UserQuery;

const isValidQuery = (rawQuery: unknown): rawQuery is Query => {
    if (typeof rawQuery !== "object" || rawQuery === null) return false;

    const { section, query } = rawQuery as Record<string, unknown>;

    if (typeof section !== "string") return false;

    switch (section) {
        case "team":
            return isValidTeamQuery(query);
        case "user":
            return isValidUserQuery(query);
        default:
            return false;
    }


};


export async function execQuery(query: unknown): Promise<QueryResultType<unknown, QueryResponseError>> {
    if (!isValidQuery(query)) {
        console.log(query);
        return {
            success: false,
            error: QueryResponseError.clientOther(
                {
                    section: typeof query === "object" ? (query as Record<string, unknown> | null)?.section : null,
                    reason: "invalid_query",
                },
                400,
                "Invalid query",
            ),
        };
    }

    switch (query.section) {
        case "team": return await execTeamQuery(query);
        case "user": return await execUserQuery(query);
    }
}

