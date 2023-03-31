import { db } from "./connector"

// async function genClient(db: Pool) {
//     let client = await db.connect()
//     return client;
// }

export async function execQuery(query: string) {
    // console.log("Executing query: " + query);
    const results = await db.query(query);
    // console.log(typeof results)
    // console.log(typeof results.rows)
    // console.log(results.rows);
    return results.rows;
}

// console.log(JSON.stringify(execQuery("select * from users")));