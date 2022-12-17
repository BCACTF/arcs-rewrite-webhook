import { HandlerFn, HandlerReturn, OutboundResponse, Payload } from "./requestHandler";
import { loadVars } from "../index";

// TODO --> Add fields and stuff once payload specs are finalized
type MainPayload = {
    _type: string;
    
}
// TODO --> Update with actual payload specs once finalized
const isValidMainPayload = (payload: Payload) : payload is MainPayload => {
    return typeof payload._type === "string";
}

export const mainHandler : HandlerFn = async (payload: Payload) => {
    const [TARGET_MAIN] = loadVars(["TARGET_MAIN"]);
    if(!isValidMainPayload(payload)) {
        return {
            status: "failure",
            content: {
                reason: "MAINHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
                statusCode: 400,
            },
        };
    }

    let response : Response = await fetch(TARGET_MAIN, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return {
        status: "success",
        content: response as unknown as OutboundResponse
    } as HandlerReturn;
};