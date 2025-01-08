
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');


const express = require('express');
const router = express.Router();

// Function to generate a confirmation token
function generateConfirmationToken() {
  const tokenLength = 16; // Length of the token
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // Characters to use for generating token
  let token = '';
  // Generate random token based on specified length
  for (let i = 0; i < tokenLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    token += characters[randomIndex];
}

return token;
}

// Function to save the user and confirmation token to the database
async function saveUserToDatabase(fullName, email, password, confirmationToken) {
  // Implement your logic to save user data and confirmation token to the database
}

// Function to send a confirmation email
async function sendConfirmationEmail(req, res) {
  const { fullName, email, password } = req.body;

  try {
      // Generate a unique confirmation token
      const confirmationToken = generateConfirmationToken();

      // Save the user and confirmation token to the database
      await saveUserToDatabase(fullName, email, password, confirmationToken);

      const confirmationLink = `http://localhost:3000/confirm/${confirmationToken}`;


      const msg = {
          to: email,
          from: 'noreply@example.com',
          subject: 'Confirm Your Email Address',
          html: `We have sent you a confirmation link to ${email}. <a href="${confirmationLink}">Click here to confirm your email address</a>.`
      };

      await sgMail.send(msg);

      res.json({ message: 'User registered successfully. Confirmation email sent.' });
  } catch (error) {
      console.error('Registration failed:', error);
      res.status(500).json({ message: 'Registration failed. Please try again later.' });
  }
}

// Define the endpoint to handle registration
router.post('/register', sendConfirmationEmail);

module.exports = router;

