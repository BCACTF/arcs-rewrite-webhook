import * as Solve from "./types";


export type SubmitAttempt = {
    __tag: "submit";
    
    user_id: Solve.Id,
    team_id: Solve.Id,
    challenge_id: Solve.Id,

    flag: string,
};

export type GetTeamSolves = {
    __tag: "get_team";
    id: string;
};
export type GetUserSolves = {
    __tag: "get_user";
    id: string;
};
export type GetChallengeSolves = {
    __tag: "get_challenge";
    id: string;
};
export type GetAllSolves = {
    __tag: "get_all";
};

type InnerSolveQuery = SubmitAttempt | GetTeamSolves | GetUserSolves | GetChallengeSolves | GetAllSolves;

type SolveQuery = {
    section: "solve";
    query: InnerSolveQuery;
};

export const isValidSolveQuery = (rawQuery: unknown): rawQuery is SolveQuery => {
    if (typeof rawQuery !== "object" || rawQuery === null) return false;

    const query = rawQuery as Record<string, unknown>;

    const { __tag } = query;

    if (typeof __tag !== "string") return false;

    switch (__tag) {
        case "submit": {
            const {
                user_id, team_id, challenge_id,
                flag,
            } = query;
            if (typeof user_id !== "string") return false;
            if (typeof team_id !== "string") return false;
            if (typeof challenge_id !== "string") return false;
            if (typeof flag !== "string") return false;
            return true;
        }
        
        case "get_team":
        case "get_user":
        case "get_challenge":
            if (typeof query.id !== "string") return false;
            else return true;

        case "get_all": {
            return true;
        }
        
        default: return false;
    }
};

export default SolveQuery;