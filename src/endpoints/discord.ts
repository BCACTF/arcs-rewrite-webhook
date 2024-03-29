import { Payload, Handler, statusCodeOkay } from './requestHandler';
import { loadVars } from '../index';
import * as log from '../logging';

enum Urgency {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
}


const allUrgencyStrings = [Urgency.LOW, Urgency.MEDIUM, Urgency.HIGH] as string[];
const isCaseInsentiveUrgency = (urgency: unknown): boolean => {
    if (typeof urgency !== 'string') return false;
    else {
        console.log(urgency);
        console.log(urgency.toUpperCase());
        return allUrgencyStrings.includes(urgency.toUpperCase());
    }
};

const upperUrgency = (urgency: Urgency): Urgency =>  {
    const upper = urgency.toUpperCase();
    return upper as Urgency;
}

type DiscordPayload = {
    _type: string;
    urgency: Urgency;
    content: string;
};

// TODO --> create auth token for discord webhook to prevent unauthorized messages
const isValidDiscordPayload = (payload: Payload): payload is DiscordPayload => {
    return isCaseInsentiveUrgency(payload.urgency) && typeof payload.content === "string";
};

interface Roles {
    adminRole: string,
    writerRole: string,
}
const getRoles = (): Roles => {
    const [adminRole, writerRole] = loadVars(["DISCORD_ADMIN_ROLE_ID", "DISCORD_PROBLEM_WRITER_ROLE_ID"]);
    return { adminRole, writerRole };
};


const urgencyMap: Record<Urgency, (keyof Roles)[]> = {
    LOW: ['adminRole'],
    MEDIUM: ['adminRole'],
    HIGH: ['adminRole', 'writerRole'],
};
const getPings = (urgency: Urgency, roles: Roles) => urgencyMap[urgency].map(key => roles[key]).map(role => `<@&${role}>`);


const getUrl = () => loadVars(["TARGET_DISCORD"])[0];

const formatMessage = (urgency: Urgency, pings: string[], content: string) => [
    '-'.repeat(20),
    `**Urgency: ${urgency.toUpperCase()}**`,
    pings.join(", "),
    content,
].join('\n');

export const discordHandler: Handler.Fn = async (payload: Payload) => {
    if (!isValidDiscordPayload(payload)) return {
        status: "failure",
        content: {
            reason: "DISCORDHANDLER: Payload `" + JSON.stringify(payload) + "` is not valid",
            statusCode: 400,
        },
    };

    const targetUrl = getUrl();

    const roles = getRoles();
    const urgency = upperUrgency(payload.urgency);
    const message_pings = getPings(urgency, roles);


    const message_body = formatMessage(urgency, message_pings, payload.content);

    // could create a pfp for the bot, but this is fine for now
    let processedBody = {
        "username": "BCACTF Notification",
        "content": message_body
    };

    log.trace`Webhook payload built: ${processedBody}`;

    let response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processedBody),
    });

    
    const resBody = await response.text();
    
    
    log.debug`Status ${response.status}: ${response.statusText}`;

    // 204 -> No Content
    const returnJson = response.status === 204 ? '' : JSON.parse(resBody);

    if (!statusCodeOkay(response.status)) {
        return {
            status: "failure",
            content: {
                reason: returnJson,
                statusCode: response.status,
            },
        };
    }

    return {
        status: "success",
        content: {
            handlerName: "discord",
            data: JSON.stringify(returnJson),
            statusCode: response.status,
            status: "Message Sent Successfully",
        },
    };
};
