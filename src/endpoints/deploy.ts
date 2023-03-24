import { HandlerFn, HandlerReturn, Payload, statusCodeOkay, uuid, isUuid } from "./requestHandler";
import { loadVars } from "../index";

///
type DeployPayload = {
    /** Type of request going **/
    _type: string;
    deploy_identifier: DeployIdentifier;

    // NOTE: Will this still be required after we start sending challenge ids instead of challenge names?
    chall_name: string;
    // NOTE: Why exactly is this here? Shouldn't this be in the repo? Or is it for one-time edits? (same for `chall_points`)
    chall_desc?: string;

    chall_points?: number; 

    // TODO: Document what this is for. Whether that's in this file, or in some central place (better), it will make development easier. 
    chall_metadata?: string;
}

type DeployIdentifier = {
    chall_id: uuid;    
    deploy_race_lock_id: uuid;
} | string;

/// Checks if a number is valid in decimal (i.e. no hex, octal, etc. and !NaN)
const isValidNumber = (n: unknown): boolean => {
    switch (typeof n) {
        case 'number':
            return true;
        case 'string':
            return !isNaN(parseInt(n));
        default:
            return false;
    }
};

const isValidUUID = (uuid: unknown): boolean => typeof uuid === 'string' && isUuid(uuid);

// TODO -- double check all validation for undefined strings
const isUndefinedString = (str: unknown): str is string | undefined => str === undefined || typeof str === "string";

const assertValidDeployIdentifier = (identifiers: unknown): identifiers is DeployIdentifier => {
    if (typeof identifiers === "string") {
        const polling_id_split = identifiers.split('.');
        console.log(polling_id_split);
        return isValidUUID(polling_id_split[0]) && isValidUUID(polling_id_split[1]);
    } else if (typeof identifiers === "object" && identifiers !== null) {
        // TODO: Make this more efficient but also type-safe.
        let relevantEntries = Object.entries(identifiers).flatMap(
            ([key, value]) => key === "chall_id" || key === "deploy_race_lock_id" ? [[key, value] as const] : [],
        );
        let chall_id = relevantEntries.find(([key]) => key === "chall_id")?.[1];
        let race_lock_id = relevantEntries.find(([key]) => key === "deploy_race_lock_id")?.[1];
        return isValidUUID(chall_id) && isValidUUID(race_lock_id);
    } else {
        return false;
    }
};



const isValidDeployPayload = (payload: Payload): payload is DeployPayload => {
    const {
        _type,
        deploy_identifier,
        chall_name: name,
        chall_points: points,
        chall_desc: desc,
        chall_meta: meta,
    } = payload

    const idsValid = assertValidDeployIdentifier(deploy_identifier);
    // NOTE: This doesn't check that the payload type is actually a type of deploy payload. Not sure if that's required though.
    const payloadValid = typeof _type === "string" && typeof name === "string";
    const requiredValid = idsValid && payloadValid;


    const pointsValid = points === undefined || isValidNumber(points);

    // if undefined, then request does not include that data
    const descValid = isUndefinedString(desc);
    const metaValid = isUndefinedString(meta);
    const stringsValid = descValid && metaValid;

    return requiredValid && pointsValid && stringsValid;
};

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
            "Authorization": "Bearer " + process.env.WEBHOOK_SERVER_AUTH_TOKEN,
        },
        body: JSON.stringify(payload),
    });

    if(!statusCodeOkay(response.status)) {
        if(response.status === 401 || response.status === 400) {
            const responseText = await response.text();
            return {
                status: "failure",
                content: {
                    reason: "DEPLOYHANDLER: " + responseText,
                    statusCode: response.status,
                }
            }
        }

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