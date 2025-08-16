import sqlite3 from 'sqlite3';
import fs from 'fs';

/**
 * receiptsテーブルのuse_imageカラムを更新する関数
 * @param imageHash レシートの画像ハッシュ
 * @param useImage 手動入力ならfalse, 画像由来ならtrue
 * @param db sqlite3.Database インスタンス
 * @returns Promise<void>
 */
export const updateUseImage = (
  imageHash: string,
  useImage: boolean,
  db: sqlite3.Database
): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE receipts SET use_image = ? WHERE image_hash = ?',
      [useImage ? 1 : 0, imageHash],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
};

/**
 * データベース接続を作成する関数
 * @param dbPath データベースファイルのパス
 * @returns sqlite3.Database
 * @throws Error if database file does not exist
 */
export const createDatabaseConnection = (dbPath: string): sqlite3.Database => {
  // データベースファイルが存在するかチェック
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file does not exist: ${dbPath}`);
  }

  return new sqlite3.Database(dbPath);
};

/**
 * データベース接続を作成する関数（初期化用）
 * ファイルが存在しない場合は新規作成する
 * @param dbPath データベースファイルのパス
 * @returns sqlite3.Database
 */
export const createDatabaseConnectionForInit = (dbPath: string): sqlite3.Database => {
  return new sqlite3.Database(dbPath);
};

/**
 * テーブルの作成
 * @param db sqlite3.Database インスタンス
 */
export const initializeDatabase = (db: sqlite3.Database): void => {
  db.serialize(() => {
    // receiptsテーブル - レシートの全情報を1つのテーブルに統合
    db.run(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_hash TEXT UNIQUE NOT NULL,
        store_name TEXT NOT NULL,
        total_amount INTEGER NOT NULL,
        receipt_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        use_image BOOLEAN NOT NULL DEFAULT 0
      )
    `);
  });
};

/**
 * CSVデータを解析してSQLiteにINSERTする関数
 * @param csvString CSVフォーマットの文字列（ヘッダー行を含む）
 * @param imageHash 画像から生成されたハッシュ値
 * @param db sqlite3.Database インスタンス
 * @returns Promise<boolean> 挿入が成功したかどうか（重複の場合はfalse）
 */
export function parseAndSaveCSV(
  csvString: string,
  imageHash: string,
  db: sqlite3.Database
): Promise<boolean> {
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
        db.run('BEGIN TRANSACTION', err => {
          if (err) {
            return reject(err);
          }

          // CSVの行に分割
          const lines = csvString.trim().split('\n');

          // ヘッダー行を取得して検証
          const header = lines[0].split(',');
          if (header[0] !== 'store_name' || header[1] !== 'total_amount') {
            db.run('ROLLBACK', () =>
              reject(new Error('Invalid CSV format. Expected header: store_name,total_amount'))
            );
            return;
          }

          // データ行を処理
          const stmt = db.prepare(
            'INSERT INTO receipts (image_hash, store_name, total_amount, receipt_date, use_image) VALUES (?, ?, ?, ?, ?)'
          );

          let hasError = false;

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            const storeName = parts[0];
            const totalAmountStr = parts[1];
            const receiptDate = parts.length > 2 ? parts[2] : null;

            const totalAmount = parseInt(totalAmountStr, 10);

            if (isNaN(totalAmount)) {
              console.warn(`Skipping invalid total amount in line ${i + 1}: ${line}`);
              continue;
            }

            stmt.run(imageHash, storeName, totalAmount, receiptDate, false, (err: Error | null) => {
              if (err && !hasError) {
                hasError = true;
                db.run('ROLLBACK', () => reject(err));
                return;
              }
            });
          }

          stmt.finalize(err => {
            if (err) {
              db.run('ROLLBACK', () => reject(err));
              return;
            }

            // トランザクションをコミット
            db.run('COMMIT', err => {
              if (err) {
                db.run('ROLLBACK', () => reject(err));
                return;
              }
              resolve(true);
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
export function getAllReceipts(db: sqlite3.Database): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT id, image_hash, store_name, total_amount, receipt_date, created_at, use_image
      FROM receipts
      ORDER BY COALESCE(receipt_date, created_at) ASC, id ASC
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
export function getReceiptTotal(imageHash: string, db: sqlite3.Database): Promise<number> {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT total_amount
      FROM receipts
      WHERE image_hash = ?
    `;

    db.get(query, [imageHash], (err, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(row?.total_amount || 0);
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
export const getReceiptDetails = (imageHash: string, db: sqlite3.Database): Promise<any> => {
  return new Promise((resolve, reject) => {
    // レシート情報を取得
    db.get('SELECT * FROM receipts WHERE image_hash = ?', [imageHash], (err, receipt) => {
      if (err) {
        return reject(err);
      }

      if (!receipt) {
        return reject(new Error(`Receipt with hash ${imageHash} not found`));
      }

      resolve(receipt);
    });
  });
};

/**
 * 指定した月のレシート金額の合計を取得する関数
 * @param year 年（例: 2025）
 * @param month 月（1〜12）
 * @param db sqlite3.Database インスタンス
 * @returns Promise<number> 指定した月の合計金額
 */
export const getMonthlyTotal = (
  year: number,
  month: number,
  db: sqlite3.Database
): Promise<number> => {
  return new Promise((resolve, reject) => {
    // 月の範囲チェック
    if (month < 1 || month > 12) {
      return reject(new Error('月は1から12の間で指定してください'));
    }

    // 指定した月の開始日と終了日を計算
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;

    // 次の月の初日を計算（月が12月の場合は翌年の1月）
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    const query = `
      SELECT SUM(total_amount) as total
      FROM receipts
      WHERE receipt_date >= ? AND receipt_date < ?
    `;

    db.get(query, [startDate, endDate], (err, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(row?.total || 0);
      }
    });
  });
};

/**
 * 指定した月のレシート詳細情報を取得する関数
 * @param year 年（例: 2025）
 * @param month 月（1〜12）
 * @param db sqlite3.Database インスタンス
 * @returns Promise<{receipts: any[], total: number}> 指定した月のレシート情報と合計金額
 */
export const getMonthlyReceiptDetails = (
  year: number,
  month: number,
  db: sqlite3.Database
): Promise<{ receipts: any[]; total: number }> => {
  return new Promise((resolve, reject) => {
    // 月の範囲チェック
    if (month < 1 || month > 12) {
      return reject(new Error('月は1から12の間で指定してください'));
    }

    // 指定した月の開始日と終了日を計算
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;

    // 次の月の初日を計算（月が12月の場合は翌年の1月）
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    const query = `
      SELECT id, image_hash, store_name, total_amount, receipt_date, created_at, use_image
      FROM receipts
      WHERE receipt_date >= ? AND receipt_date < ?
      ORDER BY COALESCE(receipt_date, created_at) ASC, id ASC
    `;

    db.all(query, [startDate, endDate], async (err, rows: any[]) => {
      if (err) {
        reject(err);
      } else {
        // use_imageをboolean型に変換しつつ合計金額を計算
        let total = 0;
        rows.forEach((row: any) => {
          row.use_image = !!row.use_image;
          total += row.total_amount;
        });

        resolve({
          receipts: rows,
          total: total,
        });
      }
    });
  });
};

/**
 * データベース接続を閉じる関数
 * @param db sqlite3.Database インスタンス
 * @returns Promise<void>
 */
export const closeDatabase = (db: sqlite3.Database): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * 手動でレシートを登録する関数
 * @param store_name 店舗名
 * @param total_amount 合計金額
 * @param receipt_date レシート日付
 * @param use_image 画像を使うかどうか
 * @param db sqlite3.Database インスタンス
 * @returns Promise<boolean> 登録が成功したかどうか
 */
export const insertManualReceipt = (
  store_name: string,
  total_amount: number,
  receipt_date: string,
  use_image: boolean,
  db: sqlite3.Database
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    // image_hashは手動登録なのでユニークな値を生成（例: store+date+amount+timestamp）
    const image_hash = `manual_${store_name}_${receipt_date}_${total_amount}_${Date.now()}`;

    db.run(
      'INSERT INTO receipts (image_hash, store_name, total_amount, receipt_date, use_image) VALUES (?, ?, ?, ?, ?)',
      [image_hash, store_name, total_amount, receipt_date, !!use_image],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      }
    );
  });
};

/**
 * 利用可能な年月のリストを取得する関数
 * @param db sqlite3.Database インスタンス
 * @returns Promise<{year: number, month: number}[]> 利用可能な年月のリスト
 */
export const getAvailableMonths = (
  db: sqlite3.Database
): Promise<{ year: number; month: number }[]> => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        strftime('%Y', receipt_date) as year,
        strftime('%m', receipt_date) as month
      FROM receipts
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

    db.all(query, (err, rows: any[]) => {
      if (err) {
        reject(err);
      } else {
        const availableMonths = rows.map(row => ({
          year: parseInt(row.year, 10),
          month: parseInt(row.month, 10),
        }));
        resolve(availableMonths);
      }
    });
  });
};

/**
 * 指定したIDのレシートを削除する関数
 * @param id レシートのID
 * @param db sqlite3.Database インスタンス
 * @returns Promise<boolean> 削除が成功したかどうか
 */
export const deleteReceipt = (id: number, db: sqlite3.Database): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM receipts WHERE id = ?', [id], function (err) {
      if (err) {
        reject(err);
      } else {
        // this.changes が 1 以上なら削除成功
        resolve(this.changes > 0);
      }
    });
  });
};

/**
 * 複数のレシートを一括削除する関数
 * @param ids レシートIDの配列
 * @param db sqlite3.Database インスタンス
 * @returns Promise<number> 削除されたレコード数
 */
export const deleteMultipleReceipts = (ids: number[], db: sqlite3.Database): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (ids.length === 0) {
      return resolve(0);
    }

    // トランザクションを開始
    db.run('BEGIN TRANSACTION', err => {
      if (err) {
        return reject(err);
      }

      const placeholders = ids.map(() => '?').join(',');
      const query = `DELETE FROM receipts WHERE id IN (${placeholders})`;

      db.run(query, ids, function (err) {
        if (err) {
          db.run('ROLLBACK', () => reject(err));
          return;
        }

        // トランザクションをコミット
        db.run('COMMIT', err => {
          if (err) {
            db.run('ROLLBACK', () => reject(err));
            return;
          }
          resolve(this.changes);
        });
      });
    });
  });
};

/**
 * レシート情報を更新する関数
 * @param id レシートID
 * @param updateData 更新するデータ
 * @param db sqlite3.Database インスタンス
 * @returns Promise<boolean> 更新が成功したかどうか
 */
export const updateReceipt = (
  id: number,
  updateData: {
    store_name?: string;
    total_amount?: number;
    receipt_date?: string;
    use_image?: boolean;
  },
  db: sqlite3.Database
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    // 更新フィールドとパラメータを動的に構築
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updateData.store_name !== undefined) {
      updateFields.push('store_name = ?');
      values.push(updateData.store_name);
    }

    if (updateData.total_amount !== undefined) {
      updateFields.push('total_amount = ?');
      values.push(updateData.total_amount);
    }

    if (updateData.receipt_date !== undefined) {
      updateFields.push('receipt_date = ?');
      values.push(updateData.receipt_date);
    }

    if (updateData.use_image !== undefined) {
      updateFields.push('use_image = ?');
      values.push(updateData.use_image ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return resolve(false); // 更新するフィールドがない
    }

    // IDをパラメータに追加
    values.push(id);

    const query = `UPDATE receipts SET ${updateFields.join(', ')} WHERE id = ?`;

    db.run(query, values, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
};
