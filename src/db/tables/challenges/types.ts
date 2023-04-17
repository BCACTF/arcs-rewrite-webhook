import QueryResultType, { QueryResponseError } from "../../queries";

type DbChallengeMeta = {
    id: Id;
    
    name: Name;
    description: Description;
    points: Points;

    authors: Authors;
    hints: Hints;
    categories: Categories;
    tags: Tags;
    links: Links;

    solve_count: SolveCount;
    visible: Visible;
    source_folder: SourceFolder;
};

type QueryReturn = QueryResultType<DbChallengeMeta, QueryResponseError>;

type Id = string;

type Name = string;
type Description = string;
type Points = number;

type Authors = string[] | null;
type Hints = string[] | null;
type Categories = string[] | null;
type Tags = string[];

type LinkType = "nc" | "web" | "admin" | "static";
type Links = Record<LinkType, string[]>;

type SolveCount = number;
type Visible = boolean;
type SourceFolder = string;



export {
    DbChallengeMeta,
    
    Id,
    Name, Description, Points,
    Authors, Hints, Categories, Tags, Links, LinkType,
    SolveCount, Visible, SourceFolder,

    QueryReturn,
}