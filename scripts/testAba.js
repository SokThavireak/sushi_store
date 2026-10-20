import { createAbaPayment } from '../services/abaPayment.js';

(async()=>{
  try {
    const res = await createAbaPayment('63', '0.10');
    console.log('ABA response:', res);
  } catch(e){
    console.error('Error calling ABA:', e);
  }
})();