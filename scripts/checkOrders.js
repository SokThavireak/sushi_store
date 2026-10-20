import pool from '../config/db.js';
(async()=>{
 try{
  const res=await pool.query('SELECT COUNT(*) as cnt FROM orders');
  console.log('Orders count:',res.rows[0].cnt);
 }catch(e){
  console.error('Error',e);
 }finally{await pool.end();}
})();