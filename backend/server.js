const express = require('express');
const path = require('path');
const { checkIp } = require("./ipcheck");
const bodyParser = require('body-parser'); 
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Your reCAPTCHA secret key
const recaptchaSecretKey = '6LdFUucpAAAAAKun-R--84qH_FwlWGTUHGCILuTe';

// PostgreSQL connection pool
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'flowdatabase',
    password: '0000',
    port: 5432,
});

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Middleware to use IP validation
app.use(checkIp);

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Endpoint to handle incoming requests
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Endpoint to serve the register.html file
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'register.html'));
});

// Endpoint to handle registration and email verification
app.post('/api/register', async (req, res) => {
    const { email, password, full_name, 'g-recaptcha-response': recaptchaResponse } = req.body;

     // Verify reCAPTCHA response
     try {
        const response = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaResponse}`);
        const { success } = response.data;
        
        if (!success) {
            return res.status(400).json({ message: 'Captcha verification failed' });
        }
    } catch (error) {
        console.error('Error verifying captcha:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }


    // Generate verification token
    const verificationToken = generateVerificationToken();

    // Set token expiration time (24 hours from now)
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
         // Check if the email already exists
         const emailCheckResult = await pool.query(
            `SELECT user_id FROM USERS WHERE email = $1`,
            [email]
        );

        if (emailCheckResult.rows.length > 0) {
            // If the email already exists, respond with an error message
            return res.status(400).json({ message: 'Email already exists. Please use a different email.' });
        }
        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10); 

        // Save user to the database
        const userResult = await pool.query(
            `INSERT INTO USERS (email, password_hash, full_name, status, is_verified)
            VALUES ($1, $2, $3, 'on hold', FALSE)
            RETURNING user_id`,
            [email, hashedPassword, full_name]
        );

        const userId = userResult.rows[0].user_id;

        // Save the verification token to the TWO_FACTOR_AUTHENTICATION table
        await pool.query(
            `INSERT INTO TWO_FACTOR_AUTHENTICATION (user_id, auth_code_hash, timestamp, status)
            VALUES ($1, $2, $3, 'sent')`,
            [userId, verificationToken, verificationTokenExpiresAt]
        );

        // Send verification email
        await sendVerificationEmail(email, verificationToken);

        // Respond to the client
        res.json({ message: 'User registered successfully. Check your email for verification instructions.' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Endpoint to handle email verification
app.get('/verify/:token', async (req, res) => {
    const token = req.params.token;

    try {
        // Find the user by the verification token in your database
        const result = await pool.query(
            `SELECT u.user_id, u.is_verified, t.timestamp AS token_expiration
             FROM USERS u
             JOIN TWO_FACTOR_AUTHENTICATION t ON u.user_id = t.user_id
             WHERE t.auth_code_hash = $1 AND t.status = 'sent'`,
            [token]
        );

        const user = result.rows[0];

        // If user not found or token is expired, handle accordingly
        if (!user || user.token_expiration < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }

        // Update user's verification status to true and update token status
        await pool.query(
            `UPDATE USERS SET is_verified = TRUE, status = 'verified' WHERE user_id = $1`,
            [user.user_id]
        );
        await pool.query(
            `UPDATE TWO_FACTOR_AUTHENTICATION SET status = 'verified' WHERE auth_code_hash = $1`,
            [token]
        );

       // Respond with an HTML page containing a success message and a link to the login page
       return res.send(`
       <html>
           <head>
               <title>Email Verified</title>
           </head>
           <body>
               <h1>Email verified successfully</h1>
               <p>Your email has been verified. You can now <a href="/index.html">log in</a>.</p>
           </body>
       </html>
   `);
} catch (error) {
   console.error('Error verifying email:', error);
   return res.status(500).json({ message: 'Internal server error' });
}
});

// Function to generate a verification token
function generateVerificationToken() {
    return crypto.randomBytes(16).toString('hex');
}

// Function to send verification email
async function sendVerificationEmail(email, token) {
    let transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: 'asarekenny59@gmail.com',
            pass: 'iutynnhnhofubisy',
        },
    });

    const verificationLink = `http://localhost:${PORT}/verify/${token}`;

    try {
        let info = await transporter.sendMail({
            from: '"Flow Application" <your@example.com>',
            to: email,
            subject: 'Email Verification',
            text: `Click the following link to verify your email: ${verificationLink}`,
        });
        console.log('Email sent:', info.messageId);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

