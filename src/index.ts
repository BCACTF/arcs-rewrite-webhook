import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv'

// TODO - add error handling for when .env file is not present, or when env vars are misconfigured
dotenv.config();
const port = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());

// TODO --> implement 404 or like otherwise just have all server requests go to this endpoint
import {router as requestHandler} from './endpoints/requestHandler';
app.use('/', requestHandler);

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});