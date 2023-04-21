import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv'
import * as log from './logging';

// TODO - add error handling for when .env file is not present, or when env vars are misconfigured
dotenv.config();
const port = process.env.PORT || 3000;

export const loadVars = (envVars: Array<string>): Array<string> => {
    const missingVars = envVars.filter(v => process.env[v] === undefined);
    if(missingVars.length > 0) {
        log.error`Missing environment variables: ${missingVars}`;
        throw new Error("Missing environment variables: " + missingVars.join(", "));
    }
    return envVars.map(v => process.env[v]) as Array<string>;
}

const app = express();
app.use(bodyParser.json());

// TODO --> implement 404 or like otherwise just have all server requests go to this endpoint
import {router as requestHandler} from './endpoints/requestHandler';
app.use('/', requestHandler);

app.listen(port, () => {
    log.info`Server started on port ${port}`;
});
