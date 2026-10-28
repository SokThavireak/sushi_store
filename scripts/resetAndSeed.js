import { Pool } from "pg";
import env from "dotenv";
import bcrypt from "bcrypt";

env.config();

const rawDbUrl = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^jdbc:/, "")
  : null;

const connectionConfig = rawDbUrl
  ? {
      connectionString: rawDbUrl,
      ssl: { rejectUnauthorized: false },
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_DATABASE || process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
      ssl: { rejectUnauthorized: false },
    };

console.log("Connecting to database with host:", connectionConfig.host || "via DATABASE_URL");

const pool = new Pool(connectionConfig);

async function resetAndSeedDatabase() {
  const client = await pool.connect();
  try {
    console.log("Connected to Neon DB. Dropping old tables...");

    await client.query(`
      DROP TABLE IF EXISTS "session" CASCADE;
      DROP TABLE IF EXISTS "order_items" CASCADE;
      DROP TABLE IF EXISTS "orders" CASCADE;
      DROP TABLE IF EXISTS "cart" CASCADE;
      DROP TABLE IF EXISTS "products" CASCADE;
      DROP TABLE IF EXISTS "categories" CASCADE;
      DROP TABLE IF EXISTS "audit_logs" CASCADE;
      DROP TABLE IF EXISTS "users" CASCADE;
    `);

    console.log("Creating fresh schema...");

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'customer',
        name VARCHAR(255),
        google_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        category VARCHAR(100),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        image_url TEXT,
        is_best_seller BOOLEAN DEFAULT false,
        discount_type VARCHAR(20) DEFAULT 'none',
        discount_value NUMERIC(10, 2) DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE cart (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        customer_name VARCHAR(255),
        total_amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT 'cash',
        order_type VARCHAR(50) DEFAULT 'dine-in',
        table_number VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_name VARCHAR(255),
        quantity INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL
      );

      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        role VARCHAR(50),
        action VARCHAR(100),
        target_type VARCHAR(100),
        target_id VARCHAR(100),
        details TEXT,
        ip VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "session" (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    console.log("Schema created. Seeding fresh users and categories...");

    const hashedAdminPassword = await bcrypt.hash("admin123", 10);
    const hashedBossPassword = await bcrypt.hash("boss123", 10);
    const hashedStaffPassword = await bcrypt.hash("staff123", 10);

    await client.query(`
      INSERT INTO users (email, password, role, name) VALUES
      ('admin@opulent.com', $1, 'admin', 'System Admin'),
      ('boss@opulent.com', $2, 'manager', 'Head Manager'),
      ('staff@opulent.com', $3, 'staff', 'Floor Staff');
    `, [hashedAdminPassword, hashedBossPassword, hashedStaffPassword]);

    const catResult = await client.query(`
      INSERT INTO categories (name) VALUES
      ('Nigiri'),
      ('Sashimi'),
      ('Special Rolls'),
      ('Maki Rolls'),
      ('Appetizers'),
      ('Beverages')
      RETURNING id, name;
    `);

    const cats = {};
    catResult.rows.forEach(c => { cats[c.name] = c.id; });

    console.log("Seeding fresh sushi products with cloud-hosted images...");

    const products = [
      {
        name: "Salmon Nigiri (2 pcs)",
        price: 5.50,
        category: "Nigiri",
        category_id: cats["Nigiri"],
        image_url: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=800&auto=format&fit=crop&q=80",
        is_best_seller: true,
        discount_type: "percentage",
        discount_value: 10,
        description: "Fresh Atlantic salmon draped over seasoned sushi rice."
      },
      {
        name: "Yellowfin Tuna Sashimi (5 pcs)",
        price: 12.00,
        category: "Sashimi",
        category_id: cats["Sashimi"],
        image_url: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80",
        is_best_seller: true,
        discount_type: "none",
        discount_value: 0,
        description: "Prime grade yellowfin tuna sliced fresh to order with wasabi."
      },
      {
        name: "Dragon Special Roll",
        price: 14.50,
        category: "Special Rolls",
        category_id: cats["Special Rolls"],
        image_url: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80",
        is_best_seller: true,
        discount_type: "fixed",
        discount_value: 2.00,
        description: "Grilled unagi eel, avocado, and cucumber with sweet kabayaki sauce."
      },
      {
        name: "Spicy Tuna Roll",
        price: 8.50,
        category: "Maki Rolls",
        category_id: cats["Maki Rolls"],
        image_url: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&auto=format&fit=crop&q=80",
        is_best_seller: true,
        discount_type: "none",
        discount_value: 0,
        description: "Chopped ahi tuna with sriracha mayo, scallions, and toasted sesame."
      },
      {
        name: "Crispy Gyoza (6 pcs)",
        price: 6.00,
        category: "Appetizers",
        category_id: cats["Appetizers"],
        image_url: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800&auto=format&fit=crop&q=80",
        is_best_seller: false,
        discount_type: "none",
        discount_value: 0,
        description: "Pan-fried pork and cabbage dumplings served with ponzu dipping sauce."
      },
      {
        name: "Edamame with Sea Salt",
        price: 4.50,
        category: "Appetizers",
        category_id: cats["Appetizers"],
        image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
        is_best_seller: false,
        discount_type: "none",
        discount_value: 0,
        description: "Steamed whole young soybean pods sprinkled with coarse sea salt."
      },
      {
        name: "Iced Matcha Green Tea",
        price: 3.50,
        category: "Beverages",
        category_id: cats["Beverages"],
        image_url: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800&auto=format&fit=crop&q=80",
        is_best_seller: false,
        discount_type: "none",
        discount_value: 0,
        description: "Authentic ceremonial Uji matcha whisked fresh and served over ice."
      }
    ];

    for (const prod of products) {
      await client.query(`
        INSERT INTO products (name, price, category, category_id, image_url, is_best_seller, discount_type, discount_value, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `, [
        prod.name,
        prod.price,
        prod.category,
        prod.category_id,
        prod.image_url,
        prod.is_best_seller,
        prod.discount_type,
        prod.discount_value,
        prod.description
      ]);
    }

    console.log("✅ Database reset and seeded successfully!");
  } catch (err) {
    console.error("❌ Error resetting and seeding database:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

resetAndSeedDatabase();

