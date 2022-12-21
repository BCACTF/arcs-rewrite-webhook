import { HandlerFn, HandlerReturn, OutboundResponse, Payload, statusCodeOkay } from "./requestHandler";
import { loadVars } from "../index";

type DeployPayload = {
    _type: string;
    chall_id: Number;
    deploy_race_lock_id: Number;
    chall_name?: string | null;
    chall_desc?: string | null;
    chall_points?: Number | null;
    chall_metadata?: string | null;
}

const isValidNumber = (n: unknown): boolean => {
    if (typeof n === 'string') {
        const parsed = Number.parseInt(n, 16);
        return !Number.isNaN(parsed);
    } else if (typeof n === 'number') return true;
    return false;
}

const isNullableString = (str: unknown): str is string | null => str === null || typeof str === "string";

const isValidDeployPayload = (payload: Payload): payload is DeployPayload => {
    const idsValid = isValidNumber(payload.chall_id) && isValidNumber(payload.deploy_race_lock_id);
    const payloadValid = typeof payload._type === "string";
    const requiredValid = idsValid && payloadValid;

    const challPointsValid = payload.chall_points === null || isValidNumber(payload.chall_points);

    const challNameValid = isNullableString(payload.chall_name);
    const challDescValid = isNullableString(payload.chall_desc);
    const challMetaValid = isNullableString(payload.chall_meta);
    const challStringsValid = challNameValid && challDescValid && challMetaValid;

    return requiredValid && challPointsValid && challStringsValid;
};



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
    // Should all 200 codes be okay?

    if(!statusCodeOkay(response.status)) {
        const responseJson = await response.json();
        return {
            status: "failure",
            content: {
                reason: responseJson.reason || "no_reason_returned",
                statusCode: response.status,
            },
        };
    }

    return {
        status: "success",
        content: response,
    };
};