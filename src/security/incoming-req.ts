import { Request, Response } from 'express';
import { timingSafeEqual, createHash } from 'crypto';

import { loadVars } from '..';
import * as log from '../logging';

const returnErrReq = (res: Response, message: string, status: number) => {
    res.statusMessage = message;
    res.status(status);
    res.send({});
};

export const checkHeadersValid = (req: Request, res: Response): boolean => {
    log.trace`Checking auth headers...`;

    //
    // Checking auth header format
    // 
    if (typeof req.headers["authorization"] === 'undefined') {
        log.secWarn`Recieved a request without an auth header: ${req.headers}`;
        returnErrReq(res, "Unauthorized", 401);
        return false;
    }

    const authHeader = req.headers["authorization"].split(" ")[1];
    const envTokens = ["DEPLOY_SERVER_AUTH_TOKEN", "FRONTEND_SERVER_AUTH_TOKEN"];
    const serverTokens = loadVars(envTokens);

    if (typeof authHeader === 'undefined') {
        log.secWarn`Recieved badly formatted auth header: ${req.headers.authorization}`;
        returnErrReq(res, "Unauthorized", 401);
        return false;
    }

    //
    // Checking value of the auth header
    // 
    let hashedAuthHeader = createHash('md5').update(authHeader).digest('hex');
    let hashedServerTokens = serverTokens.map(token => createHash('md5').update(token).digest('hex'));

    let authorized = hashedServerTokens.map((token, idx) => [
        timingSafeEqual(Buffer.from(token), Buffer.from(hashedAuthHeader)),
        envTokens[idx],
    ] as const);

    if (authorized.every(([bool, _]) => !bool)) {
        log.secWarn`Auth header did not match deploy or frontend token.`;
        returnErrReq(res, "Unauthorized", 401);
        return false;
    }
    const matchedAuthEnvVars = authorized.filter(v => v[0]).map(v => v[1]);
    log.debug`Auth header matched ${matchedAuthEnvVars}`;

    return true;
};

export const checkOauthClientAllowed = (clientSecret: string, ): boolean => {
    log.trace`Checking auth headers...`;

    const allowedClientSecrets = loadVars(["ALLOWED_OAUTH_CLIENTS"])[0].split(",");
    
    let hashedSecret = createHash('md5').update(clientSecret).digest('hex');
    let hashedSecrets = allowedClientSecrets.map(token => createHash('md5').update(token).digest('hex'));

    let authorized = hashedSecrets.map((token, idx) => timingSafeEqual(Buffer.from(token), Buffer.from(hashedSecret)));

    if(authorized.every(bool => !bool)) {
        log.secWarn`Oauth Client Permission Secret did not match registered clients.`;
        return false;
    }
    log.debug`Oauth Client Permission Secret validated.`;
    return true;
};