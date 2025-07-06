import * as appRootDir from 'app-root-dir';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ES Moduleでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

// データベースパス
export const DATABASE_PATH = path.join(appRootDir.get(), '../../database.sqlite');

// 選択可能な画像ファイル形式
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
