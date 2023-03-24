import { HandlerFn, Payload } from "./requestHandler";
import { loadVars } from "../index";

// TODO --> Add fields and stuff once payload specs are finalized
type FrontendPayload = {
    _type: string;
}
// TODO --> Update with actual payload specs once finalized
const isValidFrontendPayload = (payload: Payload): payload is FrontendPayload => {
    return typeof payload._type === "string";
}

export const frontendHandler : HandlerFn = async (payload: Payload) => {
    const [TARGET_FRONTEND] = loadVars(["TARGET_FRONTEND"]);
    if(!isValidFrontendPayload(payload)) {
        return {
            status: "failure",
            content: {
                reason: "FRONTENDHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
                statusCode: 400,
            },
        };
    }

    let response : Response = await fetch(TARGET_FRONTEND, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + process.env.WEBHOOK_SERVER_AUTH_TOKEN,
        },
        body: JSON.stringify(payload),
    });

    return {
        status: "success",
        content: response,
    };
};