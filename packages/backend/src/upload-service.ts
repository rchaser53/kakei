import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly'
];
const TOKEN_PATH = path.join(__dirname, '../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');

// 認証情報を保存
export const saveCredentials = async (client: any) => {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
};

// 保存済み認証情報を読み込み
export const loadSavedCredentialsIfExist = async (): Promise<any> => {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
};

// 認証を行う
export const authorize = async (): Promise<any> => {
  let client = await loadSavedCredentialsIfExist();
  if (client) return client;
  client = await authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });
  if (client && client.credentials) {
    await saveCredentials(client);
  }
  return client;
};

// ファイルをGoogle Driveにアップロード
export const uploadToGoogleDrive = async (filePath: string, fileName?: string): Promise<{ id: string; webViewLink: string }> => {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });
  
  const fileMetadata = { 
    name: fileName || path.basename(filePath) 
  };
  const media = { 
    mimeType: 'application/octet-stream', 
    body: createReadStream(filePath) 
  };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });
  
  return res.data as { id: string; webViewLink: string };
};

/**
 * Google Drive上でフォルダを検索
 */
export const findFolderByName = async (folderName: string, parentId?: string): Promise<string | null> => {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });
  
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
  });
  
  const folders = res.data.files || [];
  return folders.length > 0 ? folders[0].id! : null;
};

/**
 * Google Drive上でフォルダを作成
 */
export const createFolder = async (folderName: string, parentId?: string): Promise<string> => {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });
  
  const fileMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  
  if (parentId) {
    fileMetadata.parents = [parentId];
  }
  
  const res = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });
  
  return res.data.id!;
};

/**
 * 指定したパスのフォルダを作成または取得（ネストしたパスに対応）
 */
export const ensureFolderPath = async (folderPath: string): Promise<string> => {
  const pathParts = folderPath.split('/').filter(part => part.trim() !== '');
  let currentParentId: string | undefined = undefined;
  
  for (const folderName of pathParts) {
    // フォルダが存在するかチェック
    let folderId = await findFolderByName(folderName, currentParentId);
    
    if (!folderId) {
      // フォルダが存在しない場合は作成
      console.log(`Creating folder: ${folderName} ${currentParentId ? `in parent ${currentParentId}` : 'in root'}`);
      folderId = await createFolder(folderName, currentParentId);
    }
    
    currentParentId = folderId;
  }
  
  return currentParentId!;
};

/**
 * 指定したディレクトリにファイルをアップロード
 */
export const uploadToGoogleDriveFolder = async (
  filePath: string, 
  folderPath: string, 
  fileName?: string
): Promise<{ id: string; webViewLink: string; folderId: string }> => {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });
  
  // フォルダパスを確保（存在しない場合は作成）
  const folderId = await ensureFolderPath(folderPath);
  
  const fileMetadata = { 
    name: fileName || path.basename(filePath),
    parents: [folderId]
  };
  const media = { 
    mimeType: 'application/octet-stream', 
    body: createReadStream(filePath) 
  };

  console.log(`Uploading ${fileMetadata.name} to folder: ${folderPath} (ID: ${folderId})`);

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });
  
  return { 
    ...res.data as { id: string; webViewLink: string },
    folderId 
  };
};

/**
 * 複数のファイルを指定したディレクトリにバッチアップロード
 */
export const uploadMultipleFilesToFolder = async (
  filePaths: string[],
  folderPath: string
): Promise<{ 
  successful: Array<{ filePath: string; fileName: string; id: string; webViewLink: string }>;
  failed: Array<{ filePath: string; error: string }>;
  folderId: string;
}> => {
  // フォルダパスを事前に確保
  const folderId = await ensureFolderPath(folderPath);
  
  const successful: Array<{ filePath: string; fileName: string; id: string; webViewLink: string }> = [];
  const failed: Array<{ filePath: string; error: string }> = [];
  
  console.log(`Starting batch upload of ${filePaths.length} files to folder: ${folderPath}`);
  
  for (const filePath of filePaths) {
    try {
      const fileName = path.basename(filePath);
      const result = await uploadToGoogleDriveFolder(filePath, folderPath, fileName);
      
      successful.push({
        filePath,
        fileName,
        id: result.id,
        webViewLink: result.webViewLink
      });
      
      console.log(`✓ Uploaded: ${fileName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failed.push({
        filePath,
        error: errorMessage
      });
      
      console.error(`✗ Failed to upload ${path.basename(filePath)}: ${errorMessage}`);
    }
  }
  
  console.log(`Batch upload complete. Successful: ${successful.length}, Failed: ${failed.length}`);
  
  return {
    successful,
    failed,
    folderId
  };
};

/**
 * 日付ベースのフォルダパスを生成
 */
export const generateDateBasedFolderPath = (date: string, userName?: string): string => {
  const [year, month] = date.split('-');
  const yearMonth = `${year}${month}`;
  
  if (userName) {
    return `images/${yearMonth}-${userName}`;
  }
  return `images/${yearMonth}`;
};

/**
 * 日付とユーザー名でファイルをアップロード
 */
export const uploadFilesByDateAndUser = async (
  filePaths: string[],
  date: string,
  userName?: string,
  customFolderPath?: string
): Promise<{ 
  successful: Array<{ filePath: string; fileName: string; id: string; webViewLink: string }>;
  failed: Array<{ filePath: string; error: string }>;
  folderId: string;
  folderPath: string;
}> => {
  const folderPath = customFolderPath || generateDateBasedFolderPath(date, userName);
  
  console.log(`Uploading files for date: ${date}${userName ? `, user: ${userName}` : ''}`);
  console.log(`Target folder path: ${folderPath}`);
  
  const result = await uploadMultipleFilesToFolder(filePaths, folderPath);
  
  return {
    ...result,
    folderPath
  };
};

/**
 * ローカルディレクトリ内の全ファイルをGoogle Driveにアップロード
 */
export const uploadDirectoryToGoogleDrive = async (
  localDirPath: string,
  remoteFolderPath: string,
  fileExtensions?: string[]
): Promise<{
  successful: Array<{ filePath: string; fileName: string; id: string; webViewLink: string }>;
  failed: Array<{ filePath: string; error: string }>;
  folderId: string;
  totalFiles: number;
}> => {
  // ディレクトリ内のファイル一覧を取得
  const files = await fs.readdir(localDirPath);
  const filePaths: string[] = [];
  
  for (const file of files) {
    const fullPath = path.join(localDirPath, file);
    const stat = await fs.stat(fullPath);
    
    if (stat.isFile()) {
      // 拡張子フィルタがある場合はチェック
      if (fileExtensions && fileExtensions.length > 0) {
        const ext = path.extname(file).toLowerCase();
        if (fileExtensions.includes(ext)) {
          filePaths.push(fullPath);
        }
      } else {
        filePaths.push(fullPath);
      }
    }
  }
  
  console.log(`Found ${filePaths.length} files in directory: ${localDirPath}`);
  
  if (filePaths.length === 0) {
    return {
      successful: [],
      failed: [],
      folderId: await ensureFolderPath(remoteFolderPath),
      totalFiles: 0
    };
  }
  
  const result = await uploadMultipleFilesToFolder(filePaths, remoteFolderPath);
  
  return {
    ...result,
    totalFiles: filePaths.length
  };
};

/**
 * データベースファイルをbackupディレクトリにアップロード
 */
export const uploadDatabaseBackup = async (
  databasePath: string,
  customFileName?: string
): Promise<{
  id: string;
  webViewLink: string;
  folderId: string;
  fileName: string;
  uploadedAt: string;
}> => {
  // バックアップファイル名を生成（タイムスタンプ付き）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const originalName = path.basename(databasePath);
  const nameWithoutExt = path.parse(originalName).name;
  const ext = path.parse(originalName).ext;
  
  const fileName = customFileName || `${nameWithoutExt}_backup_${timestamp}${ext}`;
  
  console.log(`Uploading database backup: ${fileName} to backup folder`);
  
  const result = await uploadToGoogleDriveFolder(databasePath, 'backup', fileName);
  
  return {
    ...result,
    fileName,
    uploadedAt: new Date().toISOString()
  };
};

/**
 * 定期バックアップ用：古いバックアップファイルをクリーンアップ
 */
export const cleanupOldBackups = async (keepCount: number = 10): Promise<{
  deletedCount: number;
  remainingCount: number;
}> => {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });
  
  // backupフォルダを取得
  const backupFolderId = await findFolderByName('backup');
  if (!backupFolderId) {
    console.log('Backup folder not found, no cleanup needed');
    return { deletedCount: 0, remainingCount: 0 };
  }
  
  // backupフォルダ内のファイルを作成日時順で取得
  const res = await drive.files.list({
    q: `'${backupFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 1000,
  });
  
  const files = res.data.files || [];
  console.log(`Found ${files.length} backup files`);
  
  if (files.length <= keepCount) {
    console.log(`No cleanup needed. Current: ${files.length}, Keep: ${keepCount}`);
    return { deletedCount: 0, remainingCount: files.length };
  }
  
  // 古いファイルを削除
  const filesToDelete = files.slice(keepCount);
  let deletedCount = 0;
  
  for (const file of filesToDelete) {
    try {
      await drive.files.delete({ fileId: file.id! });
      console.log(`Deleted old backup: ${file.name}`);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete ${file.name}:`, error);
    }
  }
  
  return {
    deletedCount,
    remainingCount: files.length - deletedCount
  };
};
