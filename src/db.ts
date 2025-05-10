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
    // receiptsテーブル - レシートの基本情報
    db.run(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // receipt_itemsテーブル - レシートの品目情報
    db.run(`
      CREATE TABLE IF NOT EXISTS receipt_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_hash TEXT NOT NULL,
        item TEXT NOT NULL,
        price INTEGER NOT NULL,
        FOREIGN KEY (image_hash) REFERENCES receipts(image_hash)
      )
    `);
  });
}

/**
 * CSVデータを解析してSQLiteにINSERTする関数
 * @param csvString CSVフォーマットの文字列（ヘッダー行を含む）
 * @param imageHash 画像から生成されたハッシュ値
 * @param db sqlite3.Database インスタンス
 * @returns Promise<boolean> 挿入が成功したかどうか（重複の場合はfalse）
 */
export function parseAndSaveCSV(csvString: string, imageHash: string, db: sqlite3.Database = defaultDb): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      // まず、同じハッシュ値を持つレコードが存在するか確認
      db.get('SELECT 1 FROM receipts WHERE image_hash = ?', [imageHash], (err, row) => {
        if (err) {
          return reject(err);
        }
        
        // 既に同じハッシュ値のレコードが存在する場合
        if (row) {
          console.log(`画像ハッシュ ${imageHash} のレコードは既に存在します。スキップします。`);
          return resolve(false);
        }
        
        // トランザクションを開始
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            return reject(err);
          }
          
          // まず、receiptsテーブルにレコードを挿入
          db.run('INSERT INTO receipts (image_hash) VALUES (?)', [imageHash], function(err) {
            if (err) {
              db.run('ROLLBACK', () => reject(err));
              return;
            }
            
            // CSVの行に分割
            const lines = csvString.trim().split('\n');
            
            // ヘッダー行を取得して検証
            const header = lines[0].split(',');
            if (header[0] !== 'item' || header[1] !== 'price') {
              db.run('ROLLBACK', () => reject(new Error('Invalid CSV format. Expected header: item,price')));
              return;
            }
            
            // データ行を処理
            const stmt = db.prepare('INSERT INTO receipt_items (image_hash, item, price) VALUES (?, ?, ?)');
            
            let hasError = false;
            
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              
              const [item, priceStr] = line.split(',');
              const price = parseInt(priceStr, 10);
              
              if (isNaN(price)) {
                console.warn(`Skipping invalid price in line ${i + 1}: ${line}`);
                continue;
              }
              
              stmt.run(imageHash, item, price, (err: Error | null) => {
                if (err && !hasError) {
                  hasError = true;
                  db.run('ROLLBACK', () => reject(err));
                  return;
                }
              });
            }
            
            stmt.finalize((err) => {
              if (err) {
                db.run('ROLLBACK', () => reject(err));
                return;
              }
              
              // トランザクションをコミット
              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK', () => reject(err));
                  return;
                }
                resolve(true);
              });
            });
          });
        });
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
    const query = `
      SELECT r.id, r.image_hash, r.created_at, ri.item, ri.price
      FROM receipts r
      JOIN receipt_items ri ON r.image_hash = ri.image_hash
      ORDER BY r.id ASC, ri.id ASC
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * データベースからレシートの合計金額を取得する関数
 * @param imageHash レシートの画像ハッシュ
 * @param db sqlite3.Database インスタンス
 * @returns Promise<number>
 */
export function getReceiptTotal(imageHash: string, db: sqlite3.Database = defaultDb): Promise<number> {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT SUM(price) as total
      FROM receipt_items
      WHERE image_hash = ?
    `;
    
    db.get(query, [imageHash], (err, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(row?.total || 0);
      }
    });
  });
}

/**
 * データベースからレシートの詳細情報を取得する関数
 * @param imageHash レシートの画像ハッシュ
 * @param db sqlite3.Database インスタンス
 * @returns Promise<{receipt: any, items: any[]}>
 */
export function getReceiptDetails(imageHash: string, db: sqlite3.Database = defaultDb): Promise<{receipt: any, items: any[]}> {
  return new Promise((resolve, reject) => {
    // レシート基本情報を取得
    db.get('SELECT * FROM receipts WHERE image_hash = ?', [imageHash], (err, receipt) => {
      if (err) {
        return reject(err);
      }
      
      if (!receipt) {
        return reject(new Error(`Receipt with hash ${imageHash} not found`));
      }
      
      // レシート品目情報を取得
      db.all('SELECT * FROM receipt_items WHERE image_hash = ? ORDER BY id ASC', [imageHash], (err, items) => {
        if (err) {
          return reject(err);
        }
        
        resolve({
          receipt,
          items
        });
      });
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
