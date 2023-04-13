export type CreateNewUser = {
    __tag: "create";

    email: string;
    name: string;
    password: string;
    eligible: boolean;
};

export type UpdateUserNamePass = {
    __tag: "update";
    id: string;
    password: string;

    name: string;
    newPassword: string | null;

    eligible: boolean;
};

export type UserJoinTeam = {
    __tag: "join";
    id: string;
    password: string;

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

type InnerUserQuery = CreateNewUser | UpdateUserNamePass | UserJoinTeam | GetUser | GetAllUsers;

type UserQuery = {
    section: "user";
    query: InnerUserQuery;
};


export const isValidUserQuery = (rawQuery: unknown): rawQuery is InnerUserQuery => {
    if (typeof rawQuery !== "object" || rawQuery === null) return false;

    const query = rawQuery as Record<string, unknown>;

    const { __tag } = query;

    if (typeof __tag !== "string") return false;

    switch (__tag) {
        case "create": {
            const { email, name, password, eligible } = query;
            if (typeof email !== "string") return false;
            if (typeof name !== "string") return false;
            if (typeof password !== "string") return false;
            if (typeof eligible !== "boolean") return false;

            return true;
        }
        case "update": {
            const { id, password, name, newPassword, eligible } = query;
            if (typeof id !== "string") return false;
            if (typeof password !== "string") return false;

            
            if (typeof name !== "string") return false;
            if (typeof newPassword !== "string") return false;
            if (typeof eligible !== "boolean") return false;
            
            return true;
        }
        case "join": {
            const { id, password, teamId, teamPassword } = query;
            if (typeof id !== "string") return false;
            if (typeof password !== "string") return false;

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