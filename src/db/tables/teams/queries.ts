export type CreateNewTeam = {
    __tag: "create";

    initialUser: string;

    name: string;
    eligible: boolean;
    affiliation: string | null;
    password: string;
};

export type UpdateTeam = {
    __tag: "update";

    id: string;
    password: string;

    eligible: boolean;
    affiliation: string | null;

    name: string;
    description: string;

    newPassword: string | null;
};

export type GetTeam = {
    __tag: "get";

    id: string;
};
export type GetAllTeams = {
    __tag: "get_all";
};

type InnerTeamQuery = CreateNewTeam | UpdateTeam | GetTeam | GetAllTeams;

type TeamQuery = {
    section: "team";
    query: InnerTeamQuery;
};


export const isValidTeamQuery = (rawQuery: unknown): rawQuery is InnerTeamQuery => {
    if (typeof rawQuery !== "object" || rawQuery === null) return false;

    const query = rawQuery as Record<string, unknown>;

    const { __tag } = query;

    if (typeof __tag !== "string") return false;

    switch (__tag) {
        case "create": {
            const { initialUser, name, eligible, affiliation, password } = query;
            if (typeof initialUser !== "string") return false;
            if (typeof name !== "string") return false;
            if (typeof eligible !== "boolean") return false;
            if (typeof affiliation !== "string" && affiliation !== null) return false;
            if (typeof password !== "string") return false;

            return true;
        }
        case "update": {
            const { id, password, eligible, affiliation, name, description, newPassword } = query;
            if (typeof id !== "string") return false;
            if (typeof password !== "string") return false;

            if (typeof eligible !== "boolean") return false;
            if (typeof affiliation !== "string" && affiliation !== null) return false;

            if (typeof name !== "string") return false;
            if (typeof description !== "string") return false;
            if (typeof newPassword !== "string") return false;

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

export default TeamQuery;