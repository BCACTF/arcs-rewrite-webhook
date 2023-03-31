import { execQuery } from "../db/db";
import { HandlerFn, HandlerReturn, OutboundResponse, Payload } from "./requestHandler";

type SqlPayload = {
    _type: string;
    query: string;
}

const isValidSqlPayload = (payload: Payload): payload is SqlPayload => {
    return typeof payload._type === "string" && typeof payload.query === "string";
}

export const sqlHandler : HandlerFn = async (payload: Payload) => {
    if(!isValidSqlPayload(payload)) {
        return {
            status: "failure",
            content: {
                reason: "SQLHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
                statusCode: 400,
            },
        } as HandlerReturn
    };

    const results = await execQuery(payload.query);
    console.log(results);
    // switch this to https if servers become secure:tm: with dns fjhdsklafh djsaklfhda
    const fetchurllocal = `http://localhost:${process.env.PORT}/sql`
    console.log(fetchurllocal);
    let response : Response = await fetch(fetchurllocal, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + process.env.WEBHOOK_SERVER_AUTH_TOKEN,
        },
        body: JSON.stringify(results),
    });

    if(response.status != 200) {
        return {
            status: "failure",
            content: {
                reason: "SQL endpoint returned non-200 status code",
                statusCode: response.status,
            },
        } as HandlerReturn;
    }

    return {
        status: "success",
        content: response as unknown as OutboundResponse,
    } as HandlerReturn;
};