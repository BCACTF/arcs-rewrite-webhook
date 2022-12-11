import { HandlerFn, Payload } from "./requestHandler";

export const sqlHandler : HandlerFn = (payload: Payload) => {
    console.log("SQL HANDLER TRIGGERED");
};