import { Database } from 'sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * ユーザーテーブルを作成する関数
 */
export function createUserTable(db: Database): Promise<void> {
  return new Promise((resolve, reject) => {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    db.run(query, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * セッションテーブルを作成する関数
 */
export function createSessionTable(db: Database): Promise<void> {
  return new Promise((resolve, reject) => {
    const query = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;
    
    db.run(query, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * ユーザーを作成する関数
 */
export function createUser(db: Database, username: string, password: string): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const query = `INSERT INTO users (username, password_hash) VALUES (?, ?)`;
      
      db.run(query, [username, passwordHash], function(err) {
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

/**
 * ユーザー認証を行う関数
 */
export function authenticateUser(db: Database, username: string, password: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const query = `SELECT id, password_hash FROM users WHERE username = ?`;
    
    db.get(query, [username], async (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        resolve(null);
        return;
      }
      
      try {
        const isValid = await bcrypt.compare(password, row.password_hash);
        if (isValid) {
          resolve(row.id);
        } else {
          resolve(null);
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * セッションを作成する関数
 */
export function createSession(db: Database, userId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後
    
    const query = `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`;
    
    db.run(query, [sessionId, userId, expiresAt.toISOString()], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(sessionId);
      }
    });
  });
}

/**
 * セッションを検証する関数
 */
export function validateSession(db: Database, sessionId: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT user_id FROM sessions 
      WHERE id = ? AND expires_at > datetime('now')
    `;
    
    db.get(query, [sessionId], (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        resolve(null);
        return;
      }
      
      resolve(row.user_id);
    });
  });
}

/**
 * セッションを削除する関数
 */
export function deleteSession(db: Database, sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM sessions WHERE id = ?`;
    
    db.run(query, [sessionId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 期限切れセッションを削除する関数
 */
export function cleanupExpiredSessions(db: Database): Promise<void> {
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM sessions WHERE expires_at <= datetime('now')`;
    
    db.run(query, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
