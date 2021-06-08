require('dotenv').config();
const express = require('express')

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// import routes
const carts = require('./endpoints/cart_routes');
const items = require('./endpoints/item_routes');

app.use('/carts', carts);
app.use('/items', items);

app.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`)
});