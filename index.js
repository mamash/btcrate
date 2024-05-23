const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

const app = express();
const port = 3000;

const SECRET_KEY = process.env.SECRET_KEY;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(403);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Initialize the database
const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS btc_price (
        id SERIAL PRIMARY KEY,
        price_eur REAL,
        price_czk REAL,
        retrieved_at TIMESTAMP
      )
    `);
  } finally {
    client.release();
  }
};

initializeDatabase();

// Helper function to get BTC price
const getBTCPrice = async () => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'bitcoin',
        vs_currencies: 'eur,czk'
      }
    });
    const data = response.data.bitcoin;
    return {
      eur: data.eur,
      czk: data.czk,
      retrieved_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to fetch BTC price:', error);
    throw error;
  }
};

// Function to store BTC price in the database
const storeBTCPrice = async () => {
  try {
    const priceData = await getBTCPrice();
    const client = await pool.connect();
    try {
      await client.query('INSERT INTO btc_price (price_eur, price_czk, retrieved_at) VALUES ($1, $2, $3)', 
        [priceData.eur, priceData.czk, priceData.retrieved_at]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to store BTC price:', error);
  }
};

// Schedule the task to run every hour
cron.schedule('*/5 * * * *', storeBTCPrice);

// Route to retrieve BTC price and store in database
app.get('/retrieve', authenticateToken, async (req, res) => {
  try {
    await storeBTCPrice();
    res.json({ message: 'BTC price fetched and stored.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve BTC price' });
  }
});

// Route to get the last retrieved BTC price
app.get('/last', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT price_eur, price_czk, retrieved_at FROM btc_price ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        const data = result.rows[0];
        res.json({
          ...data,
          request_time: new Date().toISOString()
        });
      } else {
        res.status(404).json({ error: 'No data found' });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

// Route to generate token (for testing purposes)
app.post('/login', (req, res) => {
  // In a real application, you would validate the user credentials
  const user = { id: 1, username: 'test' };
  const token = jwt.sign(user, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
