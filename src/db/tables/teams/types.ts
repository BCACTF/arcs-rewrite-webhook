import QueryResultType, { QueryResponseError } from "../../queries";

type DbTeamMeta = {
    id: string;
    name: string;
    description: string;
    score: number;
    last_solve: number | null;
    eligible: boolean;
    affiliation: string | null;
};

type QueryReturn = QueryResultType<DbTeamMeta, QueryResponseError>;

type Id = string;
type Name = string;
type Description = string;
type Score = number;
type LastSolve = Date | null;
type Eligible = boolean;
type Affiliation = string | null;
type HashedPassword = string;


export {
    DbTeamMeta,
    Id, Name, Description, Score, LastSolve, Eligible, Affiliation, HashedPassword,
    QueryReturn,
}