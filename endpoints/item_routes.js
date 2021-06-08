const express = require('express');
const router = express.Router();
const pool = require('../pool');

// return all items
router.get('/', async(req, res) => {
  const text = 'SELECT * FROM items';
  
  const client = await pool.connect();

  try {
    const items = await client.query(text);
    res.send(items.rows);
  } catch(err) {
    res.send(err)
  } 

  await client.release();
});

// return item by id
router.get('/:id', async(req, res) => {
  const text = 'SELECT * FROM items WHERE id = $1;'
  const values = [req.params.id];

  const client = await pool.connect();
  try {
    const item = await client.query(text, values);
    res.send(item.rows[0]);
  } catch(err) {
    res.send(err)
  } finally {
    await client.release();
  }
});

// create item
router.post('/', async(req, res) => {
  // Name and price are required
  if (!req.body['name'] || !req.body['price']) {
    return res.send("Name and price are required in the payload");
  }

  const text = `INSERT INTO items(name, price) 
                VALUES($1, $2)
                RETURNING *;`
  const values = [req.body['name'], req.body['price']];

  const client = await pool.connect();
  try {
    const item = await client.query(text, values);
    res.send(item.rows[0]);
  } catch(err) {
    res.send(err)
  } finally {
    await client.release();
  }
});

// edit item
router.patch('/:id', async(req, res) => {
  if (!req.body) return res.send("Empty payload");

  // Allow edit of name or price only.
  const permittedColumns = ['name', 'price'];
  const values = [];
  values.push(req.params.id);

  // this string will determine the columns to update and which variables to assign
  let setColumns = '';
  
  // variable number will always start at 2 since the first variable is the id of the cart
  let varNumber = 2;
  for ( const column in req.body) {
    if (permittedColumns.includes(column)) {
      if (setColumns.length === 0) {
        setColumns += column + ' = $' + varNumber;
        varNumber++;
      } else {
        setColumns += ', ' + column + ' = $' + varNumber;
        varNumber++;
      }
      values.push(req.body[column]);
    }
  }

  const text = `UPDATE items
                SET ${setColumns}
                WHERE id = $1
                RETURNING *`;

  const client = await pool.connect();
  try {
    const item = await client.query(text, values);
    res.send(item.rows[0]);
  } catch(err) {
    res.send(err)
  } finally {
    await client.release();
  }
});

// delete item by id
router.delete('/:id', async(req, res) => {
  const text = 'DELETE FROM items WHERE id = $1';
  const values = [req.params.id];

  const client = await pool.connect();
  try {
    await client.query(text, values);
    res.send('Successfully deleted item');
  } catch(err) {
    res.send(err)
  } finally {
    await client.release();
  }
});

module.exports = router;