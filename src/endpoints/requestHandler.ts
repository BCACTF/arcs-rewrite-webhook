import express, { Request, Response, Router } from 'express';
import { validate as isValidUUID } from "uuid";
import crypto from 'crypto';

export const router : Router = express.Router();
// handlers for each target service that we recognize
import { discordHandler } from './discord';
import { sqlHandler } from './sql';
import { deployHandler } from './deploy';
import { frontendHandler } from './frontend';

export type Result<T, E> = {
    status: "success",
    content: T,
} | {
    status: "failure",
    content: E,
};

export type DataError = {
    reason: string;
    statusCode: number;
};

export type OutboundResponse = Awaited<ReturnType<typeof fetch>>;
export type HandlerReturn = Result<OutboundResponse, DataError>;
export type HandlerFn = (payload: Payload) => Promise<HandlerReturn> | HandlerReturn;

export const statusCodeOkay = (code: number): boolean => {
	return code >= 200 && code < 300;
};

type HandlerName = "DISCORD" | "SQL" | "DEPLOY" | "FRONTEND";


const handlers: Record<HandlerName, HandlerFn> = {
    "DISCORD": discordHandler,
    "SQL": sqlHandler,
    "DEPLOY": deployHandler,
    "FRONTEND": frontendHandler,
};

const isHandler = (name: string): name is HandlerName => Object.keys(handlers).includes(name);

type TargetData = Record<string, unknown>;
export type Payload = TargetData & { _type: string };

export type uuid = string;
export const isUuid = (uuid: unknown): boolean => {
    if (typeof uuid !== 'string') return false;
    else return isValidUUID(uuid);
}

const mapTargetEntry = (requestType: string, sendSuccess: HandlerName[], sendFail: HandlerName[]) => async (
    [targetName, targetData]: [string, TargetData]
): Promise<[string, HandlerReturn]> => {
    const payload = { ...targetData, _type: requestType };
    const handlerName = targetName.toUpperCase();
    if (isHandler(handlerName)) {
        const handler = handlers[handlerName];
        try {
            const response = await handler(payload);
            sendSuccess.push(handlerName);
            return [targetName, response];
        } catch (e) {
            sendFail.push(handlerName);
            console.log(e);
            return [
                targetName,
                // may include parse issues, if there is a syntax error, ensure given handler is returning the proper format (json or text)
                {
                    status: "failure",
                    content: {
                        statusCode: 500,
                        reason: `Internal Server Error: ${e}`,
                    },
                }
            ] as [string, HandlerReturn];
        }
    } else {
        console.error("ERROR OCCURRED --> REQUEST DOES NOT MATCH EXISTING TARGETS");
        return [
            "<INVALID TARGET>",
            {
                status: "failure", 
                content: {
                    statusCode: 400, 
                    reason: `${targetName} is not a valid target`,
                },
            },
        ] as [string, HandlerReturn];
    }
};

const returnErrReq = (res: Response, message: string, status: number) => {
    res.statusMessage = message;
    res.status(status);
    res.send();
}

// TODO: add a check to see if the server is running or not
router.post("/", async (req: Request, res: Response) => {
    console.log({ body: req.body });
    if(typeof req.body.targets === 'undefined' || typeof req.body._type === 'undefined') {
        console.log("Malformed request body: ", req.body);
        returnErrReq(res, "Malformed Request Body", 400);
        return;
    }

    if(typeof req.headers["authorization"] === 'undefined') {
        console.log("Recieved a request without an auth header");
        returnErrReq(res, "Unauthorized", 401);
        return;
    } else {
        const authHeader = req.headers["authorization"].split(" ")[1];
        const serverTokens = [process.env.DEPLOY_SERVER_AUTH_TOKEN, process.env.FRONTEND_SERVER_AUTH_TOKEN];

        if(typeof authHeader === 'undefined') {
            console.log("Recieved badly formatted auth header:", req.headers.authorization);
            returnErrReq(res, "Unauthorized", 401);
            return;
        }

        let hashedAuthHeader = crypto.createHash('md5').update(authHeader).digest('hex');
        let hashedServerTokens = serverTokens.map((token) => {
            if(typeof token !== 'undefined') {
                return crypto.createHash('md5').update(token).digest('hex');
            } else {
                console.error("ERROR: Missing server tokens"); 
                process.exit();
            }
        })

        let undefinedServerTokens = hashedServerTokens.filter(token => (typeof token === 'undefined'));
        if(undefinedServerTokens.length > 0){
            console.error("ERROR: Missing server tokens");
            process.exit();
        }

        let authorized = (hashedServerTokens as String[]).filter((token) => {
            console.log(crypto.timingSafeEqual(Buffer.from(token), Buffer.from(hashedAuthHeader)))
            return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(hashedAuthHeader));
        })

        if(authorized.length === 0) {
            returnErrReq(res, "Unauthorized", 401);
            return;
        }
    }

    const targets: Record<string, TargetData> = req.body.targets;
    const requestType: string = req.body._type;
    const targetEntries = Object.entries(targets);

    const sendSuccess: HandlerName[] = [];
    const sendFail: HandlerName[] = [];
    res.statusMessage = "Request pushed to: ";
    
    let handler_responses = await Promise.all(targetEntries.map(mapTargetEntry(requestType, sendSuccess, sendFail)));

    const returnedStatusCodes: number[] = [];
    
    const responseEntries = await Promise.all(handler_responses.map(async ([targetName, response]) => {
        if(response.status === 'success') {
            returnedStatusCodes.push(response.content.status);
            let text = await response.content.text();
            try {
                return [targetName, JSON.parse(text)];
            } catch (e) {
                return [targetName, text];
            }
        } else {
            returnedStatusCodes.push(response.content.statusCode);

            return [targetName, response.content];
        }
    }));
    console.log(responseEntries);

    const targetResponseMap = Object.fromEntries(responseEntries);
    

    // TODO --> notify if any requests got dropped in the process of evaluating the targets 

    res.statusMessage = res.statusMessage.slice(0, -2);
    console.log(res.statusMessage);
    res.status(200);
    res.send(targetResponseMap);
});

router.post('/frontend', async(req: Request, res: Response) => {
    console.log("--------------------")
    console.log("frontend request received");
    console.log(req.headers)
    console.log(req.body);
    res.status(200);
    res.send();
});

router.post("/sql", async (req: Request, res: Response) => {
    console.log("--------------------")
    console.log("sql request received");
    console.log(req.headers)
    console.log(req.body);
    res.status(200);
    res.send(req.body);
})