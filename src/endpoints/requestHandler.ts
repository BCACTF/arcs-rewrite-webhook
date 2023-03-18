import express, { Request, Response, Router } from 'express';
import { validate as isValidUUID } from "uuid";

export const router : Router = express.Router();
// handlers for each target service that we recognize
import { discordHandler } from './discord';
import { sqlHandler } from './sql';
import { deployHandler } from './deploy';
import { mainHandler } from './main';

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

type HandlerName = "DISCORD" | "SQL" | "DEPLOY" | "MAIN";


const handlers: Record<HandlerName, HandlerFn> = {
    "DISCORD": discordHandler,
    "SQL": sqlHandler,
    "DEPLOY": deployHandler,
    "MAIN": mainHandler,
};

const isHandler = (name: string): name is HandlerName => Object.keys(handlers).includes(name);

type TargetData = Record<string, unknown>;
export type Payload = TargetData & { _type: string };

export type uuid = string;
export const isUuid = (uuid: unknown): boolean => {
    if (typeof uuid !== 'string') return false;
    else return isValidUUID(uuid);
}

export type HandlerResponse = {
    status: "success" | "failure";
    content: Result<String, number> | DataError;
}

// parse request for targets that will get forwarded information 
router.post("/", async (req: Request, res: Response) => {
    // console.log(req.body.targets);
    if(typeof req.body.targets === 'undefined' || typeof req.body._type === 'undefined') {
        res.statusMessage = "Malformed Request Body";
        res.status(400);
        res.send();
        return;
    }

    const targets: Record<string, TargetData> = req.body.targets;
    const messageType: string = req.body._type;
    const targetEntries = Object.entries(targets);

    res.statusMessage = "Request pushed to: ";
    
    // TODO --> deal with the results returned from each HandlerFn
    // TODO --> clean up actual handlers, repeated code could be abstracted to functions
    let handler_responses = await Promise.allSettled(targetEntries.map(([targetName, targetData]) => {
        const payload = { ...targetData, _type: messageType };
        const handlerName = targetName.toUpperCase();
        if (isHandler(handlerName)) {
            const handler = handlers[handlerName];
            const response = handler(payload);
            res.statusMessage += targetName + ", ";
            
            return Promise.resolve(response);
        } else {
            console.log("ERROR OCCURRED --> REQUEST DOES NOT MATCH EXISTING ENDPOINTS");
        }
    }));


    let handle_response_bodies = handler_responses.map((response) => { 
        if(response.status === 'fulfilled'){
            return response.value as HandlerResponse;
        } else {
            // TODO --> improve handling of this case, figure out more specifically what causes undefined returns for value
            return {
                status: "failure",
                content: {
                    reason: "Promise failed to resolve",
                    statusCode: 500,
                }
            } as HandlerResponse;
        }
    });

    console.log(handle_response_bodies.filter((response) => response.status === 'failure'));
    
    //     if(typeof response !== 'undefined' && response.status === 'fulfilled') {
    //         if(typeof response.value === 'undefined' || response.value.status === 'failure') {
    //             return true;
    //         }
    //         return false;
    //     }

    //     return false;
    // });

    // TODO --> notify if any requests got dropped in the process of evaluating the targets 
    // dropped_handler_responses.forEach((response) => {
    //     console.log(response);
    // });

    res.statusMessage = res.statusMessage.slice(0, -2);
    console.log(res.statusMessage);
    res.status(200);
    res.send();    
});

router.post('/main', async(req: Request, res: Response) => {
    console.log("--------------------")
    console.log("main request received");
    console.log(req.body);
    res.status(200);
    res.send();
});

router.post("/sql", async (req: Request, res: Response) => {
    console.log("--------------------")
    console.log("sql request received");
    console.log(req.body);
    res.status(200);
    res.send();
})

router.post("/deploy", async (req: Request, res: Response) => {
    console.log("--------------------")
    console.log("deploy request received");
    console.log(req.body);
    res.status(200);
    res.send();
});
