import { HandlerFn, HandlerReturn, OutboundResponse, Payload } from "./requestHandler";
import { loadVars } from "../index";

type DeployPayload = {
    _type: string;
    chall_id: Number;
    deploy_race_lock_id: Number;
    chall_name?: string;
    chall_desc?: string;
    chall_points?: Number;
}

const isNumber = (n: unknown) : n is Number => {
    return !isNaN(n as number);
}

const isValidDeployPayload = (payload: Payload): payload is DeployPayload => {
    return isNumber(payload.chall_id) && isNumber(payload.deploy_race_lock_id) && typeof payload._type === "string"
        && (payload.chall_name === undefined || typeof payload.chall_name === "string")
        && (payload.chall_desc === undefined || typeof payload.chall_desc === "string")
        && (payload.chall_points === undefined || isNumber(payload.chall_points)); 
}

export const deployHandler : HandlerFn = async (payload: Payload) => {
    const [TARGET_DEPLOY] = loadVars(["TARGET_DEPLOY"]);

    if(!isValidDeployPayload(payload)) {
        return {
            status: "failure",
            content: {
                reason: "DEPLOYHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
                statusCode: 400,
            },
        } as HandlerReturn;
    }

    let response : Response = await fetch(TARGET_DEPLOY, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    // TODO: Handle non-200 status codes better (probably on a case-by-case basis depending on response)
    if(response.status !== 200) {
        return {
            status: "failure",
            content: {
                reason: "Deploy endpoint returned non-200 status code",
                statusCode: response.status,
            },
        } as HandlerReturn;
    }

    return {
        status: "success",
        content: response as unknown as OutboundResponse,
    } as HandlerReturn;
};