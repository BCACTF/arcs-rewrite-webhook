import { Auth } from "./types";

export type CreateNewUser = {
    __tag: "create";

    email: string;
    name: string;
    auth: Auth;
    eligible: boolean;
};

export type CheckUserAuth = {
    __tag: "auth";
    id: string;
    auth: Auth;
};

export type UpdateUserNamePass = {
    __tag: "update";
    id: string;
    auth: Auth;

    name: string;
    newPassword: string | null;

    eligible: boolean;
};

export type UserJoinTeam = {
    __tag: "join";
    id: string;
    auth: Auth;

    teamId: string;
    teamPassword: string;
};

export type GetUser = {
    __tag: "get";
    id: string;
};
export type GetAllUsers = {
    __tag: "get_all";
};

type InnerUserQuery = CreateNewUser | CheckUserAuth | UpdateUserNamePass | UserJoinTeam | GetUser | GetAllUsers;

type UserQuery = {
    section: "user";
    query: InnerUserQuery;
};

const authIsValid = (rawAuth: unknown): rawAuth is Auth => {
    if (typeof rawAuth !== "object" || rawAuth === null) return false;

    const auth = rawAuth as Record<string, unknown>;

    const { __type } = auth;

    switch (__type) {
        case "pass":
            return typeof auth.password === "string";
        case "oauth":
            return typeof auth.sub === "string" && typeof auth.provider === "string" && typeof auth.trustedClientAuth === "string";
        default:
            return false;
    }
};

export const isValidUserQuery = (rawQuery: unknown): rawQuery is InnerUserQuery => {
    if (typeof rawQuery !== "object" || rawQuery === null) return false;

    const query = rawQuery as Record<string, unknown>;

    const { __tag } = query;

    if (typeof __tag !== "string") return false;

    switch (__tag) {
        case "create": {
            const { email, name, auth, eligible } = query;
            if (typeof email !== "string") return false;
            if (typeof name !== "string") return false;
            if (!authIsValid(auth)) return false;
            if (typeof eligible !== "boolean") return false;

            return true;
        }
        case "auth": {
            const { id, auth, name, newPassword, eligible } = query;
            if (typeof id !== "string") return false;
            if (!authIsValid(auth)) return false;
            return true;
        }
        case "update": {
            const { id, auth, name, newPassword, eligible } = query;
            if (typeof id !== "string") return false;
            if (!authIsValid(auth)) return false;

            
            if (typeof name !== "string") return false;
            if (typeof newPassword !== "string") return false;
            if (typeof eligible !== "boolean") return false;
            
            return true;
        }
        case "join": {
            const { id, auth, teamId, teamPassword } = query;
            if (typeof id !== "string") return false;
            if (!authIsValid(auth)) return false;

            if (typeof teamId !== "string") return false;
            if (typeof teamPassword !== "string") return false;
            
            return true;
        }
        case "get": {
            const { id } = query;
            if (typeof id !== "string") return false;
            return true;
        }
        case "get_all": {
            return true;
        }
        default: return false;
    }
};

export default UserQuery;