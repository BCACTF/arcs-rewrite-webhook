import { HandlerFn, Payload } from "./requestHandler";
import { loadVars } from "../index";

export type FrontendPayload = {
    _type: string;
    name: string;
    points: number;
    desc: string;
    solveCount: number;
    categories: string[];
    authors: string[];
    hints: string[];
    tags: string[];

    links: any;
}

const checkStringArray = (field: any): boolean => {
    if(!Array.isArray(field)) { return false; }
    
    field.forEach((item) => {
        if(typeof item !== 'string'){
            return false;
        }
    })
    
    // currently accepts 0 length arrays
    return true;
    // return (field.length > 0) ? true : false;
}

const isValidFrontendPayload = (payload: Payload): payload is FrontendPayload => {
    let metadataValid = payload._type === "string" &&
        typeof payload.name === "string" && typeof payload.points === "number" && typeof payload.desc === "string" && typeof payload.solveCount === "number" 
        && checkStringArray(payload.categories) && checkStringArray(payload.authors) && checkStringArray(payload.hints) && checkStringArray(payload.tags)
        
    return metadataValid;
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