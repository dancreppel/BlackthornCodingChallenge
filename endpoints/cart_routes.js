const express = require('express');
const router = express.Router();
const pool = require('../pool')


// return all carts
router.get('/', async(req, res) => {
  const text = 'SELECT * FROM carts';
  
  const client = await pool.connect();

  try {
    const carts = await client.query(text);
    res.send(carts.rows);
  } catch(err) {
    res.send(err)
  } 

  await client.release();
});

// return cart by id
router.get('/:id', async(req, res) => {
  const text = 'SELECT * FROM carts WHERE id = $1;'
  const values = [req.params.id];

  const client = await pool.connect();
  try {
    const cart = await client.query(text, values);
    res.send(cart.rows[0]);
  } catch(err) {
    res.send(err)
  } finally {
    await client.release();
  }
});

// create cart
router.post('/', async(req, res) => {
  // Tax is required. Discount is optional.  
  // Subtotal and Total are calculated when items are added or subtracted
  if (!req.body['tax']) return res.send("Tax is required in the payload");

  const text = `INSERT INTO carts(discount, tax) 
                VALUES($1, $2)
                RETURNING *;`
  const values = [req.body['discount'], req.body['tax']];

  const client = await pool.connect();
  try {
    const cart = await client.query(text, values);
    res.send(cart.rows[0]);
  } catch(err) {
    res.send(err)
  } finally {
    await client.release();
  }
});

// edit cart
router.patch('/:id', async(req, res) => {
  if (!req.body) return res.send("Empty payload");

  // Allow edit of tax and discount only.
  // Subtotal and Total are dependent on associated items
  const permittedColumns = ['discount', 'tax'];
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

  const text = `UPDATE carts
                SET ${setColumns}
                WHERE id = $1
                RETURNING *`;

  const client = await pool.connect();
  try {
    const cart = await client.query(text, values);
    res.send(cart.rows[0]);
  } catch(err) {
    res.send(err)
  } finally {
    await client.release();
  }
});

// delete cart by id
router.delete('/:id', async(req, res) => {
  const text = 'DELETE FROM carts WHERE id = $1';
  const values = [req.params.id];

  const client = await pool.connect();
  try {
    await client.query(text, values);
    res.send('Successfully deleted cart');
  } catch(err) {
    res.send(err)
  } finally {
    await client.release();
  }
});

// return all items in a specified cart
router.get('/:id/items', async(req, res) => {
  const text = `SELECT items.id, price, name 
                FROM carts
                JOIN cart_items ON carts.id = cart_items.cart_id
                JOIN items ON items.id = cart_items.item_id
                WHERE carts.id = $1;`
  const values = [req.params.id];

  const client = await pool.connect();
  try {
    const items = await client.query(text, values);
    res.send(items.rows);
  } catch(err) {
    res.send(err)
  } 
  await client.release();
});

// add item to a specified cart
router.post('/:id/items', async(req, res) => {
  const text = `INSERT INTO cart_items(cart_id, item_id)
                VALUES($1, $2)
                RETURNING *;
                `
  const values = [req.params.id, req.body['itemId']];

  const client = await pool.connect();
  try {
    const [association, item, cart] = [
      await client.query(text, values),
      await client.query('SELECT * FROM items WHERE id = $1;', [req.body['itemId']]),
      await client.query('SELECT * FROM carts WHERE id = $1;', [req.params.id])
    ]

    // values are strings, so they must be converted to float
    const price = parseFloat(item.rows[0].price);
    const tax = parseFloat(cart.rows[0].tax);
    const discount = parseFloat(cart.rows[0].discount);
    let subtotal = parseFloat(cart.rows[0].subtotal);
    let total = parseFloat(cart.rows[0].total);

    // update cart with new subtotal and total
    subtotal += price;
    total = subtotal * (1 - discount / 100) * (1 + tax / 100);

    const updatedCart = await client.query(
      `UPDATE carts SET subtotal = $1, total = $2 WHERE id = $3 RETURNING *;`,
      [subtotal, total, req.params.id]
    );

    console.log(updatedCart.rows[0]);

    res.send(association.rows[0]);
  } catch(err) {
    res.send(err)
  } 
  await client.release();
});

// remove all items from cart
router.delete('/:id/items', async(req, res) => {
  const client = await pool.connect();

  try {
    await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [req.params.id]);
    await client.query(`UPDATE carts SET subtotal = 0.00, total = 0.00 WHERE id = $1`, [req.params.id]);
    res.send("Emptied cart");
  } catch(err) {
    res.send(err)
  }

  await client.release()
});

module.exports = router;