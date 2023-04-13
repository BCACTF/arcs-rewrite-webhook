type QueryResultType<T, E> = {
    success: true;
    output: T;
} | {
    success: false;
    error: E;
}





export class QueryResponseError extends Error {
    private type: "SERVER" | "CLIENT";
    private code: number;
    message: string;
    private data: unknown;

    constructor(type: "SERVER" | "CLIENT", code: number, message: string, data: unknown) {
        super(message);

        this.type = type;
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static wrap(input: unknown) {
        if (input instanceof QueryResponseError) {
            return input;
        } else {
            return QueryResponseError.server(input);
        }
    }

    public static server(data: unknown, code: number = 500, message: string = "Server Error") {
        return new QueryResponseError("SERVER", code, message, data);
    }
    public static clientOther(data: unknown, code: number = 400, message: string = "Bad Request") {
        return new QueryResponseError("CLIENT", code, message, data);
    }
    public static clientUnauth(data: unknown, code: number = 401, message: string = "Unauthorized - Authentication Required") {
        return new QueryResponseError("CLIENT", code, message, data);
    }
    public static clientNotAllowed(data: unknown, code: number = 403, message: string = "Forbidden - Inadequate Privelege") {
        return new QueryResponseError("CLIENT", code, message, data);
    }

    public getStatusCode() {
        return this.code;
    }
};

export default QueryResultType;
