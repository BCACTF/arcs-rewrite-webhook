import { Pool, PoolClient, types } from 'pg';
import QueryResultType, { QueryResponseError } from './queries';

const poolConfig = {
    host: "localhost", 
    user: process.env.USER,
    database: "arcs",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
}

export const withDbClient = <I extends unknown[], O>(
    callback: (client: PoolClient, ...params: I) => Promise<O>,
) => async (...params: I) => {
    const client = await db.connect();
    try {
        return await callback(client, ...params);
    } catch (e) {
        throw e;
    } finally {
        client.release();
    }
};
export const withTransaction = <I extends unknown[], S extends unknown>(
    callback: (client: PoolClient, ...params: I) => Promise<QueryResultType<S, QueryResponseError>>,
) => async (...params: I): Promise<Promise<QueryResultType<S, QueryResponseError>>> => {
    const client = await db.connect();
    try {
        client.query("BEGIN");
        const output = await callback(client, ...params);
        client.query("COMMIT");
        return output;
    } catch (e) {
        client.query("ROLLBACK");
        if (e instanceof QueryResponseError) return {
            success: false,
            error: e,
        };
        else {
            console.dir(e, { depth: null });
            return {
                success: false,
                error: QueryResponseError.wrap(new Error("Unknown server error")),
            };
        }
    } finally {
        client.release();
    }
};

export const db = new Pool(poolConfig);
