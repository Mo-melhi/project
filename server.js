import pg from "pg";
import express from "express";
import env from "dotenv";
import cors from "cors";

app.use(cors());
app.use(cors({
  origin: "https://project-s47h.onrender.com"
}));


const app = express();
env.config();

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect()
  .then(() => console.log("Connected to PostgreSQL 🚀"))
  .catch(err => console.error("Connection error", err.stack));

app.use(express.static('public'));
app.use(express.json()); // <-- This line parses JSON body for POST requests


app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/meals', async (req, res) => {
    try {
      const result = await db.query(`
        SELECT menu_items.item_id AS id, menu_items.name, menu_items.price, categories.name AS category 
        FROM menu_items
        JOIN categories ON menu_items.category_id = categories.category_id
        WHERE menu_items.is_available = TRUE
        ORDER BY categories.category_id, menu_items.item_id
      `);
  
      // Group meals by category
      const mealsByCategory = {};
      result.rows.forEach(meal => {
        if (!mealsByCategory[meal.category]) {
          mealsByCategory[meal.category] = [];
        }
        mealsByCategory[meal.category].push({
          id: meal.id,       // For image path like imgs/1.png
          name: meal.name,
          price: meal.price
        });
      });
  
      res.json(mealsByCategory);
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
});

app.post('/orders', async (req, res) => {
    const { cart, branchId, name, phone } = req.body;

    if (!cart || !Array.isArray(cart)) return res.status(400).send("Invalid cart.");
    if (!branchId || !name || !phone) return res.status(400).send("Missing data.");

    try {
        await db.query('BEGIN');

        // Insert customer and get ID
        const customerRes = await db.query(`
            INSERT INTO customers (name, phone_number)
            VALUES ($1, $2)
            RETURNING customer_id
        `, [name, phone]);

        const customerId = customerRes.rows[0].customer_id;

        // Insert order with customer ID
        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const orderRes = await db.query(`
            INSERT INTO orders (total_price, status, branch_id, customer_id)
            VALUES ($1, 'pending', $2, $3)
            RETURNING order_id
        `, [totalPrice, branchId, customerId]);

        const orderId = orderRes.rows[0].order_id;

        for (const item of cart) {
            await db.query(`
                INSERT INTO order_items (order_id, item_id, quantity, price)
                VALUES ($1, $2, $3, $4)
            `, [orderId, item.id, item.quantity, item.price]);
        }

        await db.query('COMMIT');
        res.status(201).send("Order complete.");
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Error processing order.");
    }
});




app.get('/branches', async (req, res) => {
    try {
        const result = await db.query('SELECT branch_id, name FROM branches');
        
        // Send both branch_id and branch_name
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching branches:", err);
        res.status(500).send("Server Error");
    }
});

app.get('/orders', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                o.order_id, 
                o.total_price, 
                c.name AS customer_name,
                c.phone_number AS customer_phone,
                b.name AS branch_name,
                m.name AS item_name,
                oi.price AS item_price,
                oi.quantity
            FROM orders o
            JOIN customers c ON o.customer_id = c.customer_id
            JOIN branches b ON o.branch_id = b.branch_id
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN menu_items m ON oi.item_id = m.item_id
            ORDER BY o.order_id DESC;
        `);

        const orders = {};

        result.rows.forEach(row => {
            const {
                order_id,
                total_price,
                customer_name,
                customer_phone,
                branch_name,
                item_name,
                item_price,
                quantity
            } = row;

            if (!orders[order_id]) {
                orders[order_id] = {
                    order_id,
                    total_price,
                    customer_name,
                    customer_phone,
                    branch_name,
                    order_items: []
                };
            }

            orders[order_id].order_items.push({
                item_name,
                item_price,
                quantity
            });
        });

        res.json(Object.values(orders));
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get('/reservations', async (req, res) => {
    try {
      const result = await db.query(`
        SELECT r.*, c.name AS customer_name, c.phone_number AS customer_phone, b.name AS branch_name
        FROM reservations r
        JOIN customers c ON r.customer_id = c.customer_id
        JOIN branches b ON r.branch_id = b.branch_id
        ORDER BY r.reservation_time DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Error loading reservations:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

  app.post('/reservations', async (req, res) => {
    try {
        const { name, phone, branchId, reservationTime, numberOfPeople } = req.body;

        // Find or insert customer
        let customerRes = await db.query(
            'SELECT customer_id FROM customers WHERE name = $1 AND phone_number = $2',
            [name, phone]
        );

        let customerId;
        if (customerRes.rows.length > 0) {
            customerId = customerRes.rows[0].customer_id;
        } else {
            const insertRes = await db.query(
                'INSERT INTO customers (name, phone_number) VALUES ($1, $2) RETURNING customer_id',
                [name, phone]
            );
            customerId = insertRes.rows[0].customer_id;
        }

        // Insert reservation
        await db.query(`
            INSERT INTO reservations (customer_id, branch_id, reservation_time, number_of_people)
            VALUES ($1, $2, $3, $4)
        `, [customerId, branchId, reservationTime, numberOfPeople]);

        res.status(201).send("Reservation created.");
    } catch (error) {
        console.error("Reservation error:", error);
        res.status(500).send("Server error.");
    }
});

app.get('/branches/hours', async (req, res) => {
    try {
      const result = await db.query(`
        SELECT name, opening_hours FROM branches
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching service hours:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete('/orders/:id', async (req, res) => {
    const orderId = req.params.id;
    try {
        await db.query('BEGIN');
        await db.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
        await db.query('DELETE FROM orders WHERE order_id = $1', [orderId]);
        await db.query('COMMIT');
        res.status(200).send("Order deleted.");
    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Error deleting order:", error);
        res.status(500).send("Internal server error");
    }
});

  

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
