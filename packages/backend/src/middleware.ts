import { Request, Response, NextFunction } from 'express';
import { validateSession } from './auth.js';
import { createDatabaseConnection } from './db.js';
import { DATABASE_PATH } from './constants.js';

// リクエストオブジェクトを拡張してユーザー情報を含める
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

/**
 * 認証が必要なルートを保護するミドルウェア
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies['session-id'];
  
  if (!sessionId) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  
  const db = createDatabaseConnection(DATABASE_PATH);
  
  validateSession(db, sessionId)
    .then((userId) => {
      db.close();
      
      if (!userId) {
        return res.status(401).json({ error: 'セッションが無効です' });
      }
      
      req.userId = userId;
      next();
    })
    .catch((error) => {
      db.close();
      console.error('セッション検証エラー:', error);
      res.status(500).json({ error: 'サーバーエラーが発生しました' });
    });
}

/**
 * ログイン状態をチェックするミドルウェア（認証が必要でない場合も使用可能）
 */
export function checkAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies['session-id'];
  
  if (!sessionId) {
    req.userId = undefined;
    return next();
  }
  
  const db = createDatabaseConnection(DATABASE_PATH);
  
  validateSession(db, sessionId)
    .then((userId) => {
      db.close();
      req.userId = userId || undefined;
      next();
    })
    .catch((error) => {
      db.close();
      console.error('セッション検証エラー:', error);
      req.userId = undefined;
      next();
    });
}
