import { HandlerFn, HandlerReturn, Payload, statusCodeOkay, uuid, isUuid } from "./requestHandler";
import { loadVars } from "../index";

// TODO --> update chall_id and deploy_race_lock_id to be/ensure UUID

type DeployPayload = {
    _type: string;
    chall_id: uuid;
    deploy_race_lock_id: uuid;
    chall_name: string;
    chall_desc?: string | undefined;
    chall_points?: Number | undefined;
    chall_metadata?: string | undefined;
}

/// Checks if a number is valid in decimal (i.e. no hex, octal, etc. and !NaN)
const isValidNumber = (n: unknown): boolean => {
    if(typeof n === 'number') return true;
    if(typeof n === 'string') {
        return (!Number.isNaN(Number(n)) && n !== "");
    }

    return false;
}

const isValidUUID = (uuid: unknown): boolean => {
    if (typeof uuid !== 'string') return false;
    else return isUuid(uuid);
}

// TODO -- double check all validation for undefined strings
const isUndefinedString = (str: unknown): str is string | undefined => str === undefined || typeof str === "string";

const isValidDeployPayload = (payload: Payload): payload is DeployPayload => {
    const idsValid = isValidUUID(payload.chall_id) && isValidUUID(payload.deploy_race_lock_id);
    const payloadValid = typeof payload._type === "string" && typeof payload.chall_name === "string";

    const requiredValid = idsValid && payloadValid;

    const challPointsValid = payload.chall_points === undefined || isValidNumber(payload.chall_points);

    // if undefined, then request does not include that data
    const challDescValid = isUndefinedString(payload.chall_desc);
    const challMetaValid = isUndefinedString(payload.chall_meta);
    
    const challStringsValid = challDescValid && challMetaValid;
    
    return requiredValid && challPointsValid && challStringsValid;
};

// TODO --> FIX ISSUES WITH REQUEST TAKING TOO LONG TO RETURN, HANDLE THEM BETTER??

export const deployHandler : HandlerFn = async (payload: Payload) => {
    const [TARGET_DEPLOY] = loadVars(["TARGET_DEPLOY"]);
    if(!isValidDeployPayload(payload)) {
        console.log("THIS INVALID")
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

    console.log(await response.json());

    return {
        status: "success",
        content: response,
    };
};