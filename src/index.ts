import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv'

// figure out better solution than this timeout library
var timeout = require('connect-timeout')

// TODO - add error handling for when .env file is not present, or when env vars are misconfigured
dotenv.config();
const port = process.env.PORT || 3000;

export const loadVars = (envVars: Array<string>): Array<string> => {
    const missingVars = envVars.filter(v => process.env[v] === undefined);
    if(missingVars.length > 0) throw new Error("Missing environment variables: " + missingVars.join(", "));
    return envVars.map(v => process.env[v]) as Array<string>;
}

const app = express();
app.use(bodyParser.json());

// TODO --> implement 404 or like otherwise just have all server requests go to this endpoint
import {router as requestHandler} from './endpoints/requestHandler';
app.use('/', timeout('600s'), requestHandler);

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});