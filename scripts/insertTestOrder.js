import pool from '../config/db.js';
(async()=>{
 try {
   const res = await pool.query(`INSERT INTO orders (user_id,total_price,payment_method,pickup_location,status,table_number) VALUES (2,0.10,'QR','Test Store','Pending',null) RETURNING id`);
   console.log('Inserted order id', res.rows[0].id);
 } catch(e){
   console.error('Insert error', e);
 } finally {
   await pool.end();
 }
})();