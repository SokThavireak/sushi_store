import bcrypt from "bcrypt";

// Initial seed data
const initialCategories = [
  { id: 1, name: "Nigiri", created_at: new Date() },
  { id: 2, name: "Sashimi", created_at: new Date() },
  { id: 3, name: "Special Rolls", created_at: new Date() },
  { id: 4, name: "Maki Rolls", created_at: new Date() },
  { id: 5, name: "Appetizers", created_at: new Date() },
  { id: 6, name: "Beverages", created_at: new Date() },
];

const initialProducts = [
  {
    id: 1,
    name: "Salmon Nigiri (2 pcs)",
    price: 5.50,
    category: "Nigiri",
    category_id: 1,
    image_url: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=800&auto=format&fit=crop&q=80",
    is_best_seller: true,
    discount_type: "percentage",
    discount_value: 10,
    description: "Fresh Atlantic salmon draped over perfectly seasoned sushi rice.",
  },
  {
    id: 2,
    name: "Yellowfin Tuna Sashimi (5 pcs)",
    price: 12.00,
    category: "Sashimi",
    category_id: 2,
    image_url: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80",
    is_best_seller: true,
    discount_type: "none",
    discount_value: 0,
    description: "Prime grade yellowfin tuna sliced fresh to order with wasabi.",
  },
  {
    id: 3,
    name: "Dragon Special Roll",
    price: 14.50,
    category: "Special Rolls",
    category_id: 3,
    image_url: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80",
    is_best_seller: true,
    discount_type: "fixed",
    discount_value: 2.00,
    description: "Grilled unagi eel, cucumber, topped with ripe avocado, kabayaki glaze, and tobiko.",
  },
  {
    id: 4,
    name: "Crispy California Roll",
    price: 7.50,
    category: "Maki Rolls",
    category_id: 4,
    image_url: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&auto=format&fit=crop&q=80",
    is_best_seller: true,
    discount_type: "none",
    discount_value: 0,
    description: "Snow crab mix, crisp cucumber, and creamy avocado with toasted sesame seeds.",
  },
  {
    id: 5,
    name: "Spicy Salmon Crunch Roll",
    price: 9.50,
    category: "Special Rolls",
    category_id: 3,
    image_url: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=800&auto=format&fit=crop&q=80",
    is_best_seller: true,
    discount_type: "percentage",
    discount_value: 15,
    description: "Spicy salmon tartare, tempura flakes, sriracha mayo, and scallions.",
  },
  {
    id: 6,
    name: "Rainbow Supreme Roll",
    price: 13.90,
    category: "Special Rolls",
    category_id: 3,
    image_url: "https://images.unsplash.com/photo-1615361200141-f45040f367be?w=800&auto=format&fit=crop&q=80",
    is_best_seller: false,
    discount_type: "none",
    discount_value: 0,
    description: "California roll topped with salmon, tuna, hamachi, and ripe avocado.",
  },
  {
    id: 7,
    name: "Ebi Shrimp Nigiri (2 pcs)",
    price: 5.00,
    category: "Nigiri",
    category_id: 1,
    image_url: "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=800&auto=format&fit=crop&q=80",
    is_best_seller: false,
    discount_type: "none",
    discount_value: 0,
    description: "Sweet butterflied tiger prawn lightly brushed with nikiri soy.",
  },
  {
    id: 8,
    name: "Steamed Edamame with Sea Salt",
    price: 4.50,
    category: "Appetizers",
    category_id: 5,
    image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
    is_best_seller: false,
    discount_type: "none",
    discount_value: 0,
    description: "Warm young soybeans tossed in Himalayan pink sea salt.",
  },
  {
    id: 9,
    name: "Traditional Miso Soup",
    price: 3.50,
    category: "Appetizers",
    category_id: 5,
    image_url: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop&q=80",
    is_best_seller: false,
    discount_type: "none",
    discount_value: 0,
    description: "Classic dashi broth with fermented white miso, silken tofu, and wakame seaweed.",
  },
  {
    id: 10,
    name: "Japanese Sencha Green Tea",
    price: 3.00,
    category: "Beverages",
    category_id: 6,
    image_url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=80",
    is_best_seller: false,
    discount_type: "none",
    discount_value: 0,
    description: "Freshly brewed premium Japanese green tea, served hot or iced.",
  },
];

const initialLocations = [
  {
    id: 1,
    name: "Murakami Central",
    address: "123 Sakura Boulevard, Central District",
    phone: "+855 23 888 123",
    status: "Open",
  },
  {
    id: 2,
    name: "Murakami Riverside",
    address: "88 Sisowath Quay, Riverside",
    phone: "+855 23 999 456",
    status: "Open",
  },
  {
    id: 3,
    name: "Murakami BKK1 Flagship",
    address: "45 Street 302, Boeung Keng Kang 1",
    phone: "+855 23 777 789",
    status: "Open",
  },
];

// Pre-hash password '123456' for demo customer
const demoPasswordHash = bcrypt.hashSync("123456", 10);

const initialUsers = [
  {
    id: 1,
    email: "admin@opulent.com",
    password: demoPasswordHash,
    role: "admin",
    created_at: new Date(),
  },
  {
    id: 2,
    email: "boss@opulent.com",
    password: demoPasswordHash,
    role: "manager",
    created_at: new Date(),
  },
  {
    id: 3,
    email: "customer@gmail.com",
    password: demoPasswordHash,
    role: "user",
    created_at: new Date(),
  },
  {
    id: 4,
    email: "staff@opulent.com",
    password: demoPasswordHash,
    role: "staff",
    assigned_location_id: 1,
    created_at: new Date(),
  },
];

const initialOrders = [
  {
    id: 1001,
    user_id: 3,
    total_price: 27.50,
    payment_method: "QR",
    pickup_location: "Murakami Central",
    status: "Completed",
    table_number: "T-04",
    created_at: new Date(Date.now() - 2 * 3600 * 1000),
  },
  {
    id: 1002,
    user_id: 3,
    total_price: 18.00,
    payment_method: "Cash",
    pickup_location: "Murakami Riverside",
    status: "Pending",
    table_number: "T-01",
    created_at: new Date(Date.now() - 30 * 60 * 1000),
  },
];

const initialOrderItems = [
  { id: 1, order_id: 1001, product_id: 1, quantity: 2, price: 5.50 },
  { id: 2, order_id: 1001, product_id: 3, quantity: 1, price: 14.50 },
  { id: 3, order_id: 1001, product_id: 10, quantity: 1, price: 3.00 },
  { id: 4, order_id: 1002, product_id: 2, quantity: 1, price: 12.00 },
  { id: 5, order_id: 1002, product_id: 4, quantity: 1, price: 7.50 },
];

let cartItems = [];
let nextCartId = 1;
let nextOrderId = 1003;
let nextUserId = 5;

// Mock database query engine
export function createMockPool() {
  const state = {
    products: [...initialProducts],
    categories: [...initialCategories],
    locations: [...initialLocations],
    users: [...initialUsers],
    orders: [...initialOrders],
    orderItems: [...initialOrderItems],
    cart: cartItems,
  };

  const query = async (sql, params = []) => {
    const rawSql = (sql || "").trim();
    const upper = rawSql.toUpperCase();

    // Transactions
    if (upper === "BEGIN" || upper === "COMMIT" || upper === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }

    // Sessions table (for connect-pg-simple compatibility if called)
    if (upper.includes("SESSION")) {
      return { rows: [], rowCount: 0 };
    }

    // Products
    if (upper.includes("FROM PRODUCTS")) {
      if (upper.includes("COUNT(*)")) {
        return { rows: [{ count: state.products.length }] };
      }
      let prods = [...state.products];
      if (upper.includes("ORDER BY ID DESC")) {
        prods.sort((a, b) => b.id - a.id);
      } else {
        prods.sort((a, b) => a.id - b.id);
      }
      return { rows: prods, rowCount: prods.length };
    }

    // Categories
    if (upper.includes("FROM CATEGORIES")) {
      let cats = [...state.categories].sort((a, b) => a.id - b.id);
      return { rows: cats, rowCount: cats.length };
    }

    // Locations
    if (upper.includes("FROM LOCATIONS")) {
      let locs = [...state.locations];
      if (upper.includes("WHERE STATUS = 'OPEN'")) {
        locs = locs.filter((l) => l.status === "Open");
      }
      if (upper.includes("ORDER BY NAME ASC")) {
        locs.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        locs.sort((a, b) => a.id - b.id);
      }
      return { rows: locs, rowCount: locs.length };
    }

    // Users
    if (upper.includes("FROM USERS")) {
      if (upper.includes("COUNT(*)")) {
        return { rows: [{ count: state.users.length }] };
      }
      if (upper.includes("WHERE EMAIL = $1")) {
        const found = state.users.filter((u) => u.email.toLowerCase() === (params[0] || "").toLowerCase());
        return { rows: found, rowCount: found.length };
      }
      return { rows: [...state.users], rowCount: state.users.length };
    }

    if (upper.startsWith("INSERT INTO USERS")) {
      const email = params[0];
      const password = params[1];
      const role = params[2] || "user";
      const newUser = { id: nextUserId++, email, password, role, created_at: new Date() };
      state.users.push(newUser);
      return { rows: [newUser], rowCount: 1 };
    }

    // Cart Join query: SELECT c.*, p.name, p.price... FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = $1
    if (upper.includes("FROM CART C") && upper.includes("JOIN PRODUCTS P")) {
      const userId = params[0];
      const items = state.cart
        .filter((c) => c.user_id == userId)
        .map((c) => {
          const prod = state.products.find((p) => p.id == c.product_id) || {};
          return {
            cart_id: c.id,
            id: c.id,
            quantity: c.quantity,
            product_id: c.product_id,
            name: prod.name || "Sushi Item",
            price: prod.price || 0,
            image_url: prod.image_url || "",
          };
        });
      return { rows: items, rowCount: items.length };
    }

    // Cart simple SELECT
    if (upper.includes("FROM CART WHERE PRODUCT_ID = $1 AND USER_ID = $2")) {
      const [productId, userId] = params;
      const found = state.cart.filter((c) => c.product_id == productId && c.user_id == userId);
      return { rows: found, rowCount: found.length };
    }

    if (upper.includes("SELECT QUANTITY FROM CART")) {
      const found = params.length >= 2
        ? state.cart.filter((c) => c.id == params[0] && c.user_id == params[1])
        : state.cart.filter((c) => c.id == params[0]);
      return { rows: found, rowCount: found.length };
    }

    // Cart INSERT
    if (upper.startsWith("INSERT INTO CART")) {
      const [userId, productId] = params;
      const newCart = { id: nextCartId++, user_id: userId, product_id: productId, quantity: 1 };
      state.cart.push(newCart);
      return { rows: [newCart], rowCount: 1 };
    }

    // Cart UPDATE
    if (upper.includes("UPDATE CART SET QUANTITY = QUANTITY + 1")) {
      if (params.length === 2) {
        if (upper.includes("PRODUCT_ID = $1")) {
          const [productId, userId] = params;
          const item = state.cart.find((c) => c.product_id == productId && c.user_id == userId);
          if (item) item.quantity += 1;
        } else {
          const [cartId, userId] = params;
          const item = state.cart.find((c) => c.id == cartId && c.user_id == userId);
          if (item) item.quantity += 1;
        }
      } else {
        const item = state.cart.find((c) => c.id == params[0]);
        if (item) item.quantity += 1;
      }
      return { rows: [], rowCount: 1 };
    }

    if (upper.includes("UPDATE CART SET QUANTITY = QUANTITY - 1")) {
      if (params.length === 2) {
        const [cartId, userId] = params;
        const item = state.cart.find((c) => c.id == cartId && c.user_id == userId);
        if (item) item.quantity = Math.max(1, item.quantity - 1);
      } else {
        const item = state.cart.find((c) => c.id == params[0]);
        if (item) item.quantity = Math.max(1, item.quantity - 1);
      }
      return { rows: [], rowCount: 1 };
    }

    // Cart DELETE
    if (upper.startsWith("DELETE FROM CART")) {
      if (upper.includes("WHERE USER_ID = $1")) {
        state.cart = state.cart.filter((c) => c.user_id != params[0]);
      } else if (params.length === 2) {
        state.cart = state.cart.filter((c) => !(c.id == params[0] && c.user_id == params[1]));
      } else if (params.length === 1) {
        state.cart = state.cart.filter((c) => c.id != params[0]);
      }
      return { rows: [], rowCount: 1 };
    }

    // Orders INSERT: INSERT INTO orders ... RETURNING id
    if (upper.startsWith("INSERT INTO ORDERS")) {
      const [userId, totalPrice, paymentMethod, pickupLocation, tableNumber] = params;
      const newOrder = {
        id: nextOrderId++,
        user_id: userId,
        total_price: parseFloat(totalPrice) || 0,
        payment_method: paymentMethod || "QR",
        pickup_location: pickupLocation || "Murakami Central",
        status: "Pending",
        table_number: tableNumber || "T-01",
        created_at: new Date(),
      };
      state.orders.unshift(newOrder);
      return { rows: [{ id: newOrder.id }], rowCount: 1 };
    }

    // Order items INSERT
    if (upper.startsWith("INSERT INTO ORDER_ITEMS")) {
      const [orderId, productId, quantity, price] = params;
      const newItem = { id: state.orderItems.length + 1, order_id: orderId, product_id: productId, quantity, price };
      state.orderItems.push(newItem);
      return { rows: [newItem], rowCount: 1 };
    }

    // Orders queries
    if (upper.includes("FROM ORDERS")) {
      if (upper.includes("COUNT(*)")) {
        return { rows: [{ count: state.orders.length }] };
      }
      if (upper.includes("SUM(TOTAL_PRICE)")) {
        const sum = state.orders
          .filter((o) => o.status === "Completed")
          .reduce((acc, o) => acc + (parseFloat(o.total_price) || 0), 0);
        return { rows: [{ sum: sum.toFixed(2) }] };
      }
      if (upper.includes("STATUS, COUNT(*)")) {
        const counts = {};
        state.orders.forEach((o) => {
          counts[o.status] = (counts[o.status] || 0) + 1;
        });
        const rows = Object.entries(counts).map(([status, count]) => ({ status, count }));
        return { rows };
      }
      if (upper.includes("TO_CHAR(CREATED_AT")) {
        const days = ["Mon 08", "Tue 09", "Wed 10", "Thu 11", "Fri 12", "Sat 13", "Sun 14"];
        const rows = days.map((day, i) => ({
          day,
          daily_sales: (30 + i * 15).toFixed(2),
        }));
        return { rows };
      }
      if (upper.includes("WHERE USER_ID = $1")) {
        const userOrders = state.orders.filter((o) => o.user_id == params[0]);
        return { rows: userOrders, rowCount: userOrders.length };
      }
      if (upper.includes("WHERE ID = $1")) {
        const order = state.orders.find((o) => o.id == params[0]);
        return { rows: order ? [order] : [], rowCount: order ? 1 : 0 };
      }
      return { rows: [...state.orders], rowCount: state.orders.length };
    }

    // Orders UPDATE
    if (upper.startsWith("UPDATE ORDERS")) {
      const orderId = params[params.length - 1];
      const order = state.orders.find((o) => o.id == orderId);
      if (order) {
        if (upper.includes("STATUS = 'COMPLETED'")) order.status = "Completed";
        if (upper.includes("STATUS = 'CANCEL REQUESTED'")) order.status = "Cancel Requested";
        if (upper.includes("STATUS = 'REFUND REQUESTED'")) order.status = "Refund Requested";
        if (upper.includes("PAYMENT_METHOD = 'CASH'")) order.payment_method = "Cash";
        if (upper.includes("PAYMENT_METHOD = 'QR'")) order.payment_method = "QR";
      }
      return { rows: [], rowCount: 1 };
    }

    // Fallback safe result for any other unhandled query
    console.warn(`[Demo Mode MockDB] Unhandled SQL query: ${rawSql.slice(0, 80)}...`);
    return { rows: [], rowCount: 0 };
  };

  const pool = {
    isMock: true,
    query,
    connect: async () => ({
      query,
      release: () => {},
    }),
    on: () => {},
  };

  return pool;
}
