import { Pool } from 'pg';

const poolConfig = {
    host: "localhost", 
    user: process.env.USER,
    database: "arcs",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
}

export const db = new Pool(poolConfig);