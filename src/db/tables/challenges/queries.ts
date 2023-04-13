import * as Chall from "./types";


export type InsertChallenge = {
    __tag: "create";

    name: Chall.Name;

    description: Chall.Description;
    flag: string;
    points: Chall.Points;

    authors: Chall.Authors;
    hints: Chall.Hints;
    categories: Chall.Categories;
    tags: Chall.Tags;
    links: unknown;

    visible: Chall.Visible | null;
    source_folder: Chall.SourceFolder;
};

export type GetChallenge = {
    __tag: "get";
    id: string;
};
export type GetAllChallenges = {
    __tag: "get_all";
};

type InnerChallengeQuery = InsertChallenge | GetChallenge | GetAllChallenges;

type ChallengeQuery = {
    section: "challenge";
    query: InnerChallengeQuery;
};

const isStringArray = (val: unknown): val is string[] => {
    if (!Array.isArray(val)) return false;
    if (!val.every<string>((v): v is string => typeof v === "string")) return false;
    return true;
}

export const isValidChallengeQuery = (rawQuery: unknown): rawQuery is ChallengeQuery => {
    if (typeof rawQuery !== "object" || rawQuery === null) return false;

    const query = rawQuery as Record<string, unknown>;

    const { __tag } = query;

    if (typeof __tag !== "string") return false;

    switch (__tag) {
        case "create": {
            const {
                name,
                description, flag, points,
                authors, hints, categories, tags,
                visible, source_folder,
            } = query;
            if (typeof name !== "string") return false;
            if (typeof description !== "string") return false;
            if (typeof flag !== "string") return false;
            if (typeof points !== "number") return false;

            if (authors !== null && !isStringArray(authors)) return false;
            if (hints !== null && !isStringArray(hints)) return false;
            if (categories !== null && !isStringArray(categories)) return false;
            if (!isStringArray(tags)) return false;
            
            if (visible !== null && typeof visible !== "boolean") return false;
            if (typeof source_folder !== "string") return false;

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

export default ChallengeQuery;