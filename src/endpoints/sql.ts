import { HandlerFn, HandlerReturn, OutboundResponse, Payload } from "./requestHandler";
import { loadVars } from "../index";

type SqlPayload = {
    _type: string;
}

const isValidSqlPayload = (payload: Payload): payload is SqlPayload => {
    return typeof payload._type === "string";
}

export const sqlHandler : HandlerFn = async (payload: Payload) => {
    const [TARGET_SQL] = loadVars(["TARGET_SQL"]);
    if(!isValidSqlPayload(payload)) {
        return {
            status: "failure",
            content: {
                reason: "SQLHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
                statusCode: 400,
            },
        } as HandlerReturn
    };

    let response : Response = await fetch(TARGET_SQL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + process.env.WEBHOOK_SERVER_AUTH_TOKEN,
        },
        body: JSON.stringify(payload),
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