import axios, { AxiosResponse } from 'axios';
import { Payload, HandlerFn } from './requestHandler';

const webhook_url = process.env.TARGET_DISCORD;

const admin = process.env.DISCORD_ADMIN_ROLE_ID;
const problem_writer = process.env.DISCORD_PROBLEM_WRITER_ROLE_ID;

type Urgency = "LOW" | "MEDIUM" | "HIGH";
type DiscordPayload = {
    _type: string;
    urgency: Urgency;
    header: string;
    content: string;
};

const isUrgency = (urgency: string) => {
    return ["LOW", "MEDIUM", "HIGH"].includes(urgency)
};
const isValidDiscordPayload = (payload: Payload): payload is DiscordPayload => {
    return typeof payload.urgency === "string" && isUrgency(payload.urgency)
        && typeof payload.header === "string"
        && typeof payload.content === "string";
};

export const discordHandler: HandlerFn = (payload) => {
    if (!isValidDiscordPayload(payload)) return {
        status: "failure",
        content: {
            reason: "Payload `" + JSON.stringify(payload) + "` is not valid",
            statusCode: 400,
        },
    };

    console.log(payload);

    // if(!Object.keys(req.body.content).length){ // breaks if content field does not exist, fix this and improve error handling
    //     res.statusMessage = "Request contained no content field. "; // really weird statusMessages because of this --> just figure out proper formatting
    //     res.status(400);
    //     res.send();
    //     // in the event that the request body is empty, throw generic error (deal with this more later most likely)
    // } else {
    //     axios
    //         .post(webhook_url as string, {
    //             content: "discordwebhookreq: " + req.body.content,
    //         })
    //         .then(function (response : AxiosResponse<any, any>) {
    //             res.status(200).send();
    //         })
    //         .catch(function (error : Error) {
    //             console.log("ERROR OCCURRED --> DISCORD HANDLER");
    //             console.log(error);
    //             res.status(500).send();
    //         });
    // };
    throw new Error();
};