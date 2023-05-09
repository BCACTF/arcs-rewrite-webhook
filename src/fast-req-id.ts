import { AsyncLocalStorage } from "node:async_hooks";



const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";


let currIdState = 0;
const getNextId = () => {
    const idNum = currIdState++;

    const l0 = alphabet.charAt(idNum % 36);
    const l1 = alphabet.charAt(Math.floor(idNum / 36) % 36);
    const l2 = alphabet.charAt(Math.floor(idNum / 36 / 36) % idNum % 36);

    return l2 + l1 + l0;
};

const storage = new AsyncLocalStorage<string>();

export const idLogWrap = <Q extends unknown[], R>(fn: (...params: Q) => R) => async (...params: Q) => {
    return await storage.run(getNextId(), () => {
        return fn(...params);
    });
};

const getReqId = () => storage.getStore();

export default getReqId;


const handlerNameStorage = new AsyncLocalStorage<string>();

export const handlerLogWrap = <Q extends unknown[], R>(handlerName: string, fn: (...params: Q) => R) => async (...params: Q) => {
    return await handlerNameStorage.run(handlerName.toUpperCase().padStart(3, " ").slice(0, 3), () => {
        return fn(...params);
    });
};

export const getHandlerName = () => handlerNameStorage.getStore();

