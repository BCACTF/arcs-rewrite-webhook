import { Payload, HandlerFn, OutboundResponse, HandlerReturn } from './requestHandler';

type Urgency = "LOW" | "MEDIUM" | "HIGH";
type DiscordPayload = {
    _type: string;
    urgency: Urgency;
    content: string;
};

const isUrgency = (urgency: string) => {
    return ["LOW", "MEDIUM", "HIGH"].includes(urgency.toUpperCase())
};

// TODO --> create auth token for discord webhook to prevent unauthorized messages
const isValidDiscordPayload = (payload: Payload): payload is DiscordPayload => {
    return typeof payload.urgency === "string" && isUrgency(payload.urgency)
        && typeof payload.content === "string";
};

// TODO --> move this to be a startup function in index.ts or something so that it doesn't crash suddenly mid-operation
const loadVars = (): Array<string> => {
    const vars = ["TARGET_DISCORD", "DISCORD_ADMIN_ROLE_ID", "DISCORD_PROBLEM_WRITER_ROLE_ID"];
    const missingVars = vars.filter(v => process.env[v] === undefined);
    if(missingVars.length > 0) throw new Error("Missing environment variables: " + missingVars.join(", "));
    return vars.map(v => process.env[v]) as Array<string>;
}


export const discordHandler: HandlerFn = async (payload: Payload) => {
    const [webhook_url, admin, problem_writer] = loadVars();
    if (!isValidDiscordPayload(payload)) return {
        status: "failure",
        content: {
            reason: "DISCORDHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
            statusCode: 400,
        },
    };

    payload.urgency = payload.urgency.toUpperCase() as Urgency;
    let message_pings;
    switch(payload.urgency){
        case "LOW":
            message_pings = "<@&" + admin + ">";
            break;
        case "MEDIUM":
            message_pings = "<@&" + admin + ">";
            break;
        case "HIGH":
            message_pings = "<@&" + admin + "> <@&" + problem_writer + ">";
            break;
    }

    const message_body = "------------------------------------\n" +    
                         "**Urgency:** " + payload.urgency + "\n" +
                          message_pings                    + "\n" +
                          payload.content;

    // could create a pfp for the bot, but this is fine for now
    let processedBody = {
            "username": "BCACTF Notification",
            "content": message_body
        };

    let response : Response = await fetch(webhook_url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(processedBody),
    });
    
    if(response.status !== 200) {
        return {
            status: "failure",
            content: {
                reason: "Discord endpoint returned non-200 status code",
                statusCode: response.status,
            },
        } as HandlerReturn;
    }

    return {
        status: "success",
        content: response as unknown as OutboundResponse
    } as HandlerReturn;
};