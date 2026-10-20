import pool from '../config/db.js';
(async () => {
  try {
    await pool.query('BEGIN');
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
    await pool.query('COMMIT');
    console.log('✅ All orders and order_items cleared');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ Error clearing orders:', err);
  } finally {
    await pool.end();
  }
})();
