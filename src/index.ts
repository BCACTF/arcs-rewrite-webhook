const express = require("express");
const bodyParser = require("body-parser");
const axios = require('axios');

const port = process.env.PORT || 3000;

require('dotenv').config();
const webhook_url = process.env.WEBHOOK_URL;

const app = express();
app.use(bodyParser.json());

app.post("/webhook", async (req: any, res: any) => {
    console.log(req.body);

    if(!Object.keys(req.body).length){ 
        res.statusMessage = "Request contained no body";
        res.status(400);
        res.send(); } // in the event that the request body is empty, throw generic error (deal with this more later most likely)
    else {
        axios.post('https://discord.com/api/webhooks/1050589962560614440/IheSNTJLUBPwtZhy832bC4vJOuIy2ST_9J6-XUh24-AMGBSrQYLSkDhs7K_Z0yKUsa2y', {
            content: "discordwebhookreq: " + req.body.content,
          })
          .then(function (response : String) {
            // console.log(response);
            res.status(200).send();
          })
          .catch(function (error : Error) {
            console.log(error);
            res.status(500).send();
          });
    }; 
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});