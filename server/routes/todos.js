const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const authenticate = require('../auth');

const VALID_PRIORITIES = ['low', 'medium', 'high'];

router.use(authenticate);

// GET все туду
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST создать туду
router.post('/', async (req, res) => {
  const { title, priority = 'medium', due_date = null } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
  if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

  try {
    const result = await pool.query(
      'INSERT INTO todos (user_id, title, priority, due_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, title.trim(), priority, due_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT обновить туду — ИСПРАВЛЕН баг с COALESCE и boolean false
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, completed, priority, due_date } = req.body;

  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  try {
    // Строим SET динамически — только переданные поля
    const fields = [];
    const values = [];
    let i = 1;

    if (title !== undefined)     { fields.push(`title = $${i++}`);     values.push(title.trim()); }
    if (completed !== undefined) { fields.push(`completed = $${i++}`); values.push(Boolean(completed)); }
    if (priority !== undefined)  { fields.push(`priority = $${i++}`);  values.push(priority); }
    if (due_date !== undefined)  { fields.push(`due_date = $${i++}`);  values.push(due_date || null); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(id, req.userId);
    const result = await pool.query(
      `UPDATE todos SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE удалить туду
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;