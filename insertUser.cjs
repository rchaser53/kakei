const bcrypt = require('bcryptjs');
const path = require('node:path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DATABASE_PATH = path.join(__dirname, './packages/backend/database.sqlite');

// データベースファイルが存在するかチェック
if (!fs.existsSync(DATABASE_PATH)) {
  console.error(`Database file does not exist: ${DATABASE_PATH}`);
  console.error('Please create the database file first by running the application.');
  process.exit(1);
}

const db = new sqlite3.Database(DATABASE_PATH);

function insertUser(db, username, password) {
  return new Promise(async (resolve, reject) => {
    try {
      // パスワードをハッシュ化
      const passwordHash = await bcrypt.hash(password, 10);

      const query = `INSERT INTO users (username, password_hash) VALUES (?, ?)`;
      db.run(query, [username, passwordHash], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

const username = process.env.USER_NAME;
const password = process.env.PASSWORD;

if (username == null || password == null) {
  console.error(`環境変数 USER_NAME または PASSWORD が設定されていません。`);
  return;
}

;(async () => {
  try {
    const userId = await insertUser(db, username, password);
    console.log('Inserted user with ID:', userId);
  } catch (error) {
    console.error('Error inserting user:', error);
  } finally {
    db.close();
  }
})();