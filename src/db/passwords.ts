import { hash, verify } from "argon2";

const verifyHash = (password: string, hash: string) => verify(hash, password);

const createHash = (password: string) => hash(password);

export {
    verifyHash,
    createHash,
};
