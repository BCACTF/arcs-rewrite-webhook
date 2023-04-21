import { Handler, Payload, statusCodeOkay, uuid, isUuid } from "./requestHandler";
import { loadVars } from "../index";
import * as log from '../logging';

type DeployPayload = {
    /** Type of request going **/
    _type: string;
    deploy_identifier: DeployIdentifier;
    chall_name: string;
}

type DeployIdentifier = uuid | string;

/// Checks if a number is valid in decimal (i.e. no hex, octal, etc. and !NaN)
// const isValidNumber = (n: unknown): boolean => {
//     switch (typeof n) {
//         case 'number':
//             return true;
//         case 'string':
//             return !isNaN(parseInt(n));
//         default:
//             return false;
//     }
// };

export const isValidUUID = (uuid: unknown): boolean => typeof uuid === 'string' && isUuid(uuid);

// TODO -- double check all validation for undefined strings
// const isUndefinedString = (str: unknown): str is string | undefined => str === undefined || typeof str === "string";

const isValidDeployPayload = (payload: Payload): payload is DeployPayload => {
    const {
        _type,
        deploy_identifier,
        chall_name,
    } = payload

    const idsValid = isValidUUID(deploy_identifier);
    // NOTE: This doesn't check that the payload type is actually a type of deploy payload. Not sure if that's required though.
    const payloadValid = typeof _type === "string" && typeof chall_name === "string";
    const requiredValid = idsValid && payloadValid;

    return requiredValid;
};

export const deployHandler: Handler.Fn = async (payload: Payload) => {
    const [TARGET_DEPLOY] = loadVars(["TARGET_DEPLOY"]);
    if(!isValidDeployPayload(payload)) {
        log.warn`Invalid deploy payload recieved`;
        log.debug`Payload: ${payload}`;
        return {
            status: "failure",
            content: {
                reason: "DEPLOYHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
                statusCode: 400,
            },
        };
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
                reason: String(responseJson.reason) || "no_reason_returned",
                statusCode: response.status,
            },
        };
    }

    return {
        status: "success",
        content: {
            data: await response.json(),
            statusCode: response.status,
            status: response.statusText,
            handlerName: "deploy",
        },
    };
};