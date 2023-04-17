import QueryResultType, { QueryResponseError } from "../../queries";

type DbSolveMeta = {
    id: Id;

    challenge_id: Id;
    user_id: Id;
    team_id: Id;

    correct: Correct;
    counted: Counted;

    timestamp: Timestamp;
};

type QueryReturn = QueryResultType<DbSolveMeta, QueryResponseError>;

type Id = string;
type Correct = boolean;
type Counted = boolean;
type Timestamp = number;



export {
    DbSolveMeta,
    
    Id,
    Correct, Counted, Timestamp,

    QueryReturn,
}