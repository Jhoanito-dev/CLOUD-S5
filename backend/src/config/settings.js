const db = require('./database');

// Get the latest value for a given key from settings_history
const getLatestSetting = async (key) => {
  try {
    const res = await db.query(
      'SELECT value, created_at FROM settings_history WHERE key = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
      [key]
    );
    if (res.rows.length === 0) return null;
    return { value: res.rows[0].value, created_at: res.rows[0].created_at };
  } catch (error) {
    console.error('GetLatestSetting error:', error.message);
    return null;
  }
};

// Insert a new setting entry (keeps history)
const insertSetting = async (key, value) => {
  try {
    await db.query(
      'INSERT INTO settings_history (key, value) VALUES ($1, $2)',
      [key, String(value)]
    );
    return true;
  } catch (error) {
    console.error('InsertSetting error:', error.message);
    return false;
  }
};

// Specific helpers for price_per_m2
const getPricePerM2 = async () => {
  const row = await getLatestSetting('price_per_m2');
  if (!row) return null;
  const num = parseFloat(row.value);
  return Number.isNaN(num) ? null : { price: num, created_at: row.created_at };
};

const setPricePerM2 = async (price) => {
  if (typeof price !== 'number' || !isFinite(price) || price < 0) {
    throw new Error('Invalid price');
  }
  return await insertSetting('price_per_m2', price);
};

module.exports = {
  getLatestSetting,
  insertSetting,
  getPricePerM2,
  setPricePerM2,
};
