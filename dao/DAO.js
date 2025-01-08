const { Pool } = require('pg');
const bcrypt = require('bcrypt');

class DAO {
    constructor({ host, port, database, username, password }) {
        this.pool = new Pool({
            host,
            port,
            database,
            user: username,
            password,
        });
    }

    async executeQuery(query, params) {
        const client = await this.pool.connect();
        try {
            const res = await client.query(query, params);
            return res.rows;
        } finally {
            client.release();
        }
    }

    printCredentials() {
        console.log({
            host: this.pool.options.host,
            port: this.pool.options.port,
            database: this.pool.options.database,
            username: this.pool.options.user,
            password: this.pool.options.password,
        });
    }

    async getUsers() {
        const client = await this.pool.connect();
        try {
            const res = await client.query("SELECT user_id, full_name, email from users", []);
            return res.rows;
        } finally {
            client.release();
        }
    }


    async saveUser({ email, full_name, password }) {
        const client = await this.pool.connect();
        try {
            // Check if a user with the same email or full name already exists
            const checkUserQuery = "SELECT user_id, full_name, email FROM users WHERE full_name = $1";
            const checkUserResult = await client.query(checkUserQuery, [full_name, email]);

            if (checkUserResult.rows.length === 0) {
              // Hash the password before storing it
              const hashedPassword = await bcrypt.hash(password, 10); // Adjust the saltRounds as needed

                // Insert the new user if no such user exists
                const insertUserQuery = "INSERT INTO users (full_name, email) VALUES ($1, $2) RETURNING user_id, full_name, email";
                const insertUserResult = await client.query(insertUserQuery, [full_name, email, hashedPassword]);
                return insertUserResult.rows[0];
            } else {
                // Return an error or handle the case where the user already exists
                return { error: 'User with this email already exists' };
            }
          } catch (error) {
            // Handle errors
            console.error('Error saving user:', error);
            throw error; // Rethrow the error to be caught by the caller
        } finally {
            client.release();
        }
    }
}

module.exports = { DAO };