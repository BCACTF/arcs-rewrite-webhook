import { Handler, Payload, uuid } from "./requestHandler";
import { loadVars } from "../index";
import { isValidUUID } from "./deploy";
import * as log from '../logging';

export type FrontendPayload = {
    _type: string;
    chall_id: uuid;
    poll_id: uuid;
}

const isValidFrontendPayload = (payload: Payload): payload is FrontendPayload => {
    let metadataValid = (typeof payload._type === "string") &&
        isValidUUID(payload.chall_id) && isValidUUID(payload.poll_id);

    console.log()
    return metadataValid;
}

export const frontendHandler : Handler.Fn = async (payload: Payload) => {
    log.trace`Frontend handler called.`;

    const [TARGET_FRONTEND] = loadVars(["TARGET_FRONTEND"]);
    if(!isValidFrontendPayload(payload)) {
        console.log("FRONTEND PAYLOAD IS INVALID IT BREAKS HERE");
        console.log(payload);
        return {
            status: "failure",
            content: {
                reason: "FRONTENDHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
                statusCode: 400,
            },
        };
    }

    if(payload._type === "SyncSuccessDeploy") {
        console.log("forwarding the request woo");
        let response : Response = await fetch(TARGET_FRONTEND + "/api/chall-deploy", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + process.env.WEBHOOK_SERVER_AUTH_TOKEN,
            },
            body: JSON.stringify(payload),
        });
        console.log("forwardedfdanthe request woo");
        return {
            status: "success",
            content: {
                data: await response.json(),
                handlerName: "frontend",
                status: response.statusText,
                statusCode: response.status,
            },
        }

    } else {
        console.log("alternate frontend thing idk");
        let response : Response = await fetch(TARGET_FRONTEND, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + process.env.WEBHOOK_SERVER_AUTH_TOKEN,
            },
            body: JSON.stringify(payload),
        });
        console.log("alternate frontend thing fdasjhkfbdsauofbvyrewuif");
        return {
            status: "success",
            content: {
                data: await response.json(),
                handlerName: "frontend",
                status: response.statusText,
                statusCode: response.status,
            },
        };
    }
};