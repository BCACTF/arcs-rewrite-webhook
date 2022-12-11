import { HandlerFn, Payload } from "./requestHandler";

export const deployHandler : HandlerFn = (payload: Payload) => {
    console.log("DEPLOY HANDLER TRIGGERED");
};