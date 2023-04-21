import { execQuery } from "../db/db";
import { Handler, Payload } from "./requestHandler";

type SqlPayload = {
    _type: string;
    query: string;
}

const isValidSqlPayload = (payload: Payload): payload is SqlPayload => {
    return typeof payload._type === "string"
}

export const sqlHandler: Handler.Fn = async (payload: Payload) => {
    if(!isValidSqlPayload(payload)) {
        return {
            status: "failure",
            content: {
                reason: "SQLHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
                statusCode: 400,
            },
        };
    };

    const queryResult = await execQuery(payload);

    if (!queryResult.success) {
        return {
            status: "failure",
            content: {
                reason: queryResult.error.message,
                statusCode: queryResult.error.getStatusCode(),
            },
        };
    } else {
        return {
            status: "success",
            content: {
                data: JSON.stringify(queryResult.output),
                handlerName: "sql",
                status: "Sql Query Executed Successfully",
                statusCode: 200,
            },
        };
    }
};