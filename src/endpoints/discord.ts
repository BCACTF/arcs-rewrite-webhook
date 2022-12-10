import axios, { AxiosResponse } from 'axios';

const webhook_url = process.env.TARGET_DISCORD;

export const discordHandler = (req: any, res: any) => {
    console.log(req.body);

    if(!Object.keys(req.body.content).length){ // breaks if content field does not exist, fix this and improve error handling
        res.statusMessage = "Request contained no content field. "; // really weird statusMessages because of this --> just figure out proper formatting
        res.status(400);
        res.send(); } // in the event that the request body is empty, throw generic error (deal with this more later most likely)
    else {
        axios.post(webhook_url as string, {
            content: "discordwebhookreq: " + req.body.content,
          })
          .then(function (response : AxiosResponse<any, any>) {
            res.status(200).send();
          })
          .catch(function (error : Error) {
            console.log("ERROR OCCURRED --> DISCORD HANDLER");
            console.log(error);
            res.status(500).send();
          });
    }; 
};
