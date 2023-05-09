import express, { Request, Response, Router } from 'express';

import crypto from 'crypto';
import { validate as isValidUUID } from "uuid";

import * as log from '../logging';
import { loadVars } from '..';
import { handlerLogWrap, idLogWrap } from '../fast-req-id';

// handlers for each target service that we recognize
import { discordHandler } from './discord';
import { sqlHandler } from './sql';
import { deployHandler } from './deploy';
import { frontendHandler } from './frontend';
import { checkHeadersValid } from '../security/incoming-req';

export type Result<T, E> = {
    status: "success",
    content: T,
} | {
    status: "failure",
    content: E,
};


/**
 * Contains the types and the high-level mappings for the server handlers.
 * 
 * See {@link Handler.lookup lookup} for the exact mappings.
 */
export namespace Handler {
    export type Name = "DISCORD" | "SQL" | "DEPLOY" | "FRONTEND";

    export type Success = {
        handlerName: string;
        data: string;
        statusCode: number;
        status?: string;
    };
    export type Error = {
        reason: string;
        statusCode: number;
    };
    
    export type Output = Result<Success, Error>;
    export type Fn = (payload: Payload) => Promise<Output> | Output;
    

    export const lookup: Record<Name, Fn> = {
        "DISCORD": discordHandler,
        "SQL": sqlHandler,
        "DEPLOY": deployHandler,
        "FRONTEND": frontendHandler,
    };

    export const isHandler = (name: string): name is Handler.Name => Object.keys(lookup).includes(name);
}

type TargetData = Record<string, unknown>;
export type Payload = TargetData & { _type: string };

export type uuid = string;
export const isUuid = (uuid: unknown): boolean => {
    if (typeof uuid !== 'string') return false;
    else return isValidUUID(uuid);
}

export const statusCodeOkay = (code: number): boolean => {
    return code >= 200 && code < 300;
};
export const statusCodeInvReq = (code: number): boolean => {
    return code >= 400 && code < 500;
};
export const statusCodeSerErr = (code: number): boolean => {
    return code >= 500 && code < 600;
};


export const router: Router = express.Router();


/**
 * This is an ***incredibly*** important helper function for the main server handling.
 * 
 * Its main purpose is to execute the handler function that is intended for each target. (associations defined in {@link Handler.lookup lookup})
 * 
 * ### It *SHOULD* catch all invalid targets, along with exceptions, but note that it is *NOT* guaranteed to work.
 * 
 * Handler functions are required to return a {@link Handler.Output} so that their data is JSON serializable.
 * 
 * ---
 * 
 * ### Params
 * @param requestType The base name of the request. (Ex: `sqlquery`, `poll`, `FrontendSuccess`, etc.)
 * @param targetName The name of the target the associated data is meant to be sent to. This will be used to select the handler function.
 * @param targetData The TARGET-SPECIFIC data associated with the request.
 * @returns The 
 */
const mapTargetEntry = async (
    requestType: string,
    targetName: string,
    targetData: unknown,
): Promise<Handler.Output> => {
    if (typeof targetData !== 'object' || targetData === null || Array.isArray(targetData)) {
        log.error`The ${targetName} payload was of invalid type ${targetData === null ? 'null' : typeof targetData}`;
        log.debug`Payload recieved: ${targetData}`;
        return {
            status: "failure", 
            content: {
                statusCode: 400, 
                reason: `Each target must have an object data payload. '${targetName}' recieved a '${targetData === null ? 'null' : typeof targetData}'.`,
            },
        };
    } 

    const payload = { ...targetData, _type: requestType };
    const handlerName = targetName.toUpperCase();

    if (!Handler.isHandler(handlerName)) {
        log.error`Request targets the ${targetName} endpoint, which doesn't exist.`;
        return {
            status: "failure", 
            content: {
                statusCode: 400, 
                reason: `${targetName} is not a valid target`,
            },
        };
    }

    const handler = Handler.lookup[handlerName];
    try {
        log.trace`Executing the ${handlerName} handler...`;
        return await handler(payload);
    } catch (e) {
        log.error`Handler ${targetName} failed with error ${e}`;
        // may include parse issues, if there is a syntax error, ensure given handler is returning the proper format (json or text)
        return {
            status: "failure",
            content: {
                statusCode: 500,
                reason: `Internal Server Error: ${e}`,
            },
        };
    }
};


// TODO: add a check to see if the server is running or not
router.post("/", idLogWrap(async (req: Request, res: Response) => {
    log.info`Main server post request recieved from ${req.ip}`;
    
    if (!checkHeadersValid(req, res)) return;
    
    //
    // Setting up for handling
    // 
    const targets: Record<string, unknown> = req.body.targets;
    const requestType: string = req.body._type;
    const targetEntries = Object.entries(targets);
    

    log.debug`Endpoints requested: ${targetEntries.map(([name, _]) => name)}`;

    //
    // Execute handlers
    // 
    const handlerResponses = await Promise.all(targetEntries.map(
        async ([target, data]) => [ target, await handlerLogWrap(target, mapTargetEntry)(requestType, target, data) ] as const
    ));



    const returnedStatusCodes: number[] = [];

    const okHandlers: string[] = [];
    const erHandlers: [string, number][] = [];

    const responseEntries = await Promise.all(handlerResponses.map(([targetName, response]) => {
        returnedStatusCodes.push(response.content.statusCode);

        if(response.status === 'success') {
            okHandlers.push(targetName);
            const data = response.content.data;
            log.debug`Handler ${targetName} success`;
            try {
                return [targetName, JSON.parse(data)] as const;
            } catch (e) {
                log.warn`Failed to parse response body as json, returning raw.`;
                return [targetName, data] as const; 
            }
        } else {
            erHandlers.push([targetName, response.content.statusCode]);
            log.warn`Handler ${targetName} failed.`;
            return [targetName, response.content] as const;
        }
    }));
    const targetResponseMap = Object.fromEntries(responseEntries);
    

    if (erHandlers.length > 0) {
        const errors = Object.fromEntries(erHandlers);
        log.warn`Handlers failed: ${errors}`;
        const message = `Handlers failed ${erHandlers.map(([name, code]) => `${name}: ${code}`).join(", ")};`

        const codes = erHandlers.map(([_, code]) => code);
        const clientCode = codes.filter(statusCodeInvReq)[0];
        const serverCode = codes.filter(statusCodeSerErr)[0];
        const statusCode = clientCode ?? serverCode ?? 500;

        res.statusMessage = message; 
        res.status(statusCode);
        res.send(targetResponseMap);
    } else {
        // TODO --> notify if any requests got dropped in the process of evaluating the targets     
        log.info`All handlers succeeded`;
        log.debug`Handlers: ${okHandlers}`;
        const message = `Request pushed to ${okHandlers.join(', ')}`;
        log.info`Status: ${message}`;
    
        res.statusMessage = message;
        res.status(200);
        res.send(targetResponseMap);
    }

}));


const tryIntParse = (str: string | undefined) => str && (parseInt(str) || str);
router.post('/frontend', idLogWrap((req: Request, res: Response) => {
    log.info`Frontend mirror request recieved.`;

    log.debug`content-length: ${tryIntParse(req.headers['content-length'])}; content-type: ${req.headers['content-type']}`;
    log.debug`agent: ${req.headers['user-agent']}`;

    res.status(200);
    res.send();
}));

router.post("/sql", idLogWrap((req: Request, res: Response) => {
    log.info`SQL mirror request recieved.`;
    
    log.debug`content-length: ${tryIntParse(req.headers['content-length'])}; content-type: ${req.headers['content-type']}`;
    log.debug`agent: ${req.headers['user-agent']}`;

    log.debug`data: ${req.body}`;

    res.status(200);
    res.send(req.body);
}));
