import sqlite3 from 'sqlite3';
import path from 'path';
import { DATABASE_PATH } from './constants.js';

/**
 * データベース接続を作成する関数
 * @param dbPath データベースファイルのパス
 * @returns sqlite3.Database
 */
export function createDatabaseConnection(dbPath: string): sqlite3.Database {
  return new sqlite3.Database(dbPath);
}

// デフォルトのデータベース接続
const defaultDb = createDatabaseConnection(DATABASE_PATH);

/**
 * テーブルの作成
 * @param db sqlite3.Database インスタンス
 */
export function initializeDatabase(db: sqlite3.Database = defaultDb): void {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item TEXT NOT NULL,
        price INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

/**
 * CSVデータを解析してSQLiteにINSERTする関数
 * @param csvString CSVフォーマットの文字列（ヘッダー行を含む）
 * @param db sqlite3.Database インスタンス
 * @returns Promise<void>
 */
export function parseAndSaveCSV(csvString: string, db: sqlite3.Database = defaultDb): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // CSVの行に分割
      const lines = csvString.trim().split('\n');
      
      // ヘッダー行を取得して検証
      const header = lines[0].split(',');
      if (header[0] !== 'item' || header[1] !== 'price') {
        return reject(new Error('Invalid CSV format. Expected header: item,price'));
      }
      
      // データ行を処理
      const stmt = db.prepare('INSERT INTO receipts (item, price) VALUES (?, ?)');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [item, priceStr] = line.split(',');
        const price = parseInt(priceStr, 10);
        
        if (isNaN(price)) {
          console.warn(`Skipping invalid price in line ${i + 1}: ${line}`);
          continue;
        }
        
        stmt.run(item, price);
      }
      
      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * データベースからレシートデータを取得する関数
 * @param db sqlite3.Database インスタンス
 * @returns Promise<any[]>
 */
export function getAllReceipts(db: sqlite3.Database = defaultDb): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM receipts ORDER BY id ASC', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * データベース接続を閉じる関数
 * @param db sqlite3.Database インスタンス
 * @returns Promise<void>
 */
export function closeDatabase(db: sqlite3.Database = defaultDb): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// デフォルトのデータベース接続を初期化
initializeDatabase(defaultDb);
