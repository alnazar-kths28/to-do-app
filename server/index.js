const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Отдаём фронтенд
app.use(express.static(path.join(__dirname, '../public')));

// API роуты
app.use('/api/auth', require('./routes/auth'));
app.use('/api/todos', require('./routes/todos'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});