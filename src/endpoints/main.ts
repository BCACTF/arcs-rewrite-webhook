
import { HandlerFn, Payload } from "./requestHandler";

export const mainHandler : HandlerFn = (payload: Payload) => {
    console.log("MAIN HANDLER TRIGGERED");
};