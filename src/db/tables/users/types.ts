import QueryResultType, { QueryResponseError } from "../../queries";

type DbUserMeta = {
    id: Id;
    email: Email;
    name: Name;
    team_id: TeamId;
    score: number;
    last_solve: number | null;
    eligible: boolean;
    admin: boolean;
};

type QueryReturn = QueryResultType<DbUserMeta, QueryResponseError>;

type Id = string;
type Email = string;
type Name = string;
type TeamId = string | null;
type Score = number;
type LastSolve = Date | null;
type Eligible = boolean;
type Admin = boolean;


type HashedPassword = string;


export {
    DbUserMeta,
    Id, Email, Name, TeamId, Score, LastSolve, Eligible, Admin,
    HashedPassword,
    QueryReturn,
}