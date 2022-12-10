import express, { Router } from 'express';
export const router : Router = express.Router();

// handlers for each target service that we recognize
import { discordHandler } from './discord';
import { sqlHandler } from './sql';
import { deployHandler } from './deploy';
import { mainHandler } from './main';

// parse request for targets that will get forwarded information 
router.post("/", async (req: any, res: any) => {
    console.log(req.body.targets);
    res.statusMessage = "Request pushed to: ";
    req.body.targets.forEach((target: string) => {

        // TODO --> convert all handlers to return Either statements possibly
        switch(target.toUpperCase()) {
            case "DISCORD":
                discordHandler(req, res);
                res.statusMessage += target + ", ";
                break;
            case "SQL":
                sqlHandler(req, res);
                res.statusMessage += target + ", ";
                break;
            case "DEPLOY":
                deployHandler(req, res);
                res.statusMessage += target + ", ";
                break;
            case "MAIN":
                mainHandler(req, res);
                res.statusMessage += target + ", ";
                break;
            default:
                console.log("ERROR OCCURRED --> REQUEST DOES NOT MATCH EXISTING ENDPOINTS");
                break;
        } 
    });

    // TODO --> notify if any requests got dropped in the process of evaluating the targets 
    res.statusMessage = res.statusMessage.slice(0, -2);
    console.log(res.statusMessage);
    res.status(200);
    res.send();    
});