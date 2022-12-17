import express, { Request, Response, Router } from 'express';
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

export type OutboundResponse = ReturnType<typeof fetch>;
export type HandlerReturn = Result<OutboundResponse, DataError>;
export type HandlerFn = (payload: Payload) => Promise<HandlerReturn> | HandlerReturn;


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

// parse request for targets that will get forwarded information 
router.post("/", async (req: Request, res: Response) => {
    const targets: Record<string, TargetData> = req.body.targets;
    const messageType: string = req.body._type;
    const targetEntries = Object.entries(targets);

    res.statusMessage = "Request pushed to: ";
    
    // TODO --> deal with the results returned from each HandlerFn
    targetEntries.map(([targetName, targetData]) => {
        const payload = { ...targetData, _type: messageType };
        const handlerName = targetName.toUpperCase();
        if (isHandler(handlerName)) {
            const handler = handlers[handlerName];
            const response = handler(payload);
            res.statusMessage += targetName + ", ";
        } else {
            console.log("ERROR OCCURRED --> REQUEST DOES NOT MATCH EXISTING ENDPOINTS");
        }
    });

    // TODO --> notify if any requests got dropped in the process of evaluating the targets 
    res.statusMessage = res.statusMessage.slice(0, -2);
    console.log(res.statusMessage);
    res.status(200);
    res.send();    
});
