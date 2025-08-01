import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';
import { authorize } from './upload-service.js';

// 画像ファイルの拡張子
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.mp4', '.mov'];

/**
 * Google Drive上のファイル一覧を取得
 */
export const listGoogleDriveFiles = async (query?: string) => {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });

  const searchQuery = query || "mimeType contains 'image/' or mimeType contains 'video/'";
  
  console.log('Google Drive API Query:', searchQuery);
  
  const res = await drive.files.list({
    q: searchQuery,
    fields: 'files(id, name, createdTime, mimeType, size)',
    orderBy: 'createdTime desc',
    pageSize: 1000,
  });

  console.log('Google Drive API Response - Total files found:', res.data.files?.length || 0);
  if (res.data.files && res.data.files.length > 0) {
    console.log('First 3 files:', res.data.files.slice(0, 3).map(f => ({
      name: f.name,
      createdTime: f.createdTime,
      mimeType: f.mimeType
    })));
  }

  return res.data.files || [];
};

/**
 * 指定した日付範囲の画像ファイルを取得
 */
export const getImagesByDateRange = async (startDate: string, endDate: string) => {
  // RFC 3339形式で日付範囲を指定
  const startDateTime = `${startDate}T00:00:00Z`;
  const endDateTime = `${endDate}T23:59:59Z`;
  
  console.log('Searching for images in range:', startDateTime, 'to', endDateTime);
  
  const query = `(mimeType contains 'image/' or mimeType contains 'video/') and createdTime >= '${startDateTime}' and createdTime <= '${endDateTime}'`;
  return await listGoogleDriveFiles(query);
};

/**
 * 指定した日付の画像ファイルを取得
 */
export const getImagesByDate = async (date: string) => {
  // RFC 3339形式で日付範囲を指定
  const startDateTime = `${date}T00:00:00Z`;
  const endDateTime = `${date}T23:59:59Z`;
  
  console.log('Searching for images between:', startDateTime, 'and', endDateTime);
  
  // Google Drive APIのクエリ構文に従って修正
  const query = `(mimeType contains 'image/' or mimeType contains 'video/') and createdTime >= '${startDateTime}' and createdTime <= '${endDateTime}'`;
  
  const files = await listGoogleDriveFiles(query);
  
  // より広い範囲でも検索してみる（前後1日）
  if (files.length === 0) {
    console.log('No files found for exact date, trying broader search...');
    const prevDate = new Date(date + 'T00:00:00Z');
    prevDate.setDate(prevDate.getDate() - 1);
    const nextDate = new Date(date + 'T00:00:00Z');
    nextDate.setDate(nextDate.getDate() + 1);
    
    const broadStartDateTime = prevDate.toISOString();
    const broadEndDateTime = nextDate.toISOString();
    
    console.log('Broader search range:', broadStartDateTime, 'to', broadEndDateTime);
    
    const broadQuery = `(mimeType contains 'image/' or mimeType contains 'video/') and createdTime >= '${broadStartDateTime}' and createdTime <= '${broadEndDateTime}'`;
    const broadFiles = await listGoogleDriveFiles(broadQuery);
    
    console.log('Broader search found:', broadFiles.length, 'files');
    
    // 実際の指定日のファイルのみをフィルタリング
    return broadFiles.filter(file => {
      if (!file.createdTime) return false;
      const fileDate = new Date(file.createdTime).toISOString().split('T')[0];
      return fileDate === date;
    });
  }
  
  return files;
};

/**
 * Google Driveからファイルをダウンロード
 */
export const downloadFileFromGoogleDrive = async (fileId: string, fileName: string, downloadPath: string) => {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });

  // ダウンロードディレクトリが存在しない場合は作成
  await fs.mkdir(downloadPath, { recursive: true });

  const filePath = path.join(downloadPath, fileName);
  
  try {
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, {
      responseType: 'stream',
    });

    // ファイルストリームを書き込み
    const writeStream = await fs.open(filePath, 'w');
    const stream = response.data as NodeJS.ReadableStream;

    return new Promise<string>((resolve, reject) => {
      const fileWriteStream = writeStream.createWriteStream();
      
      stream.pipe(fileWriteStream);
      
      fileWriteStream.on('finish', async () => {
        await writeStream.close();
        resolve(filePath);
      });
      
      fileWriteStream.on('error', async (err) => {
        await writeStream.close();
        reject(err);
      });
    });
  } catch (error) {
    throw new Error(`ファイルのダウンロードに失敗しました: ${error}`);
  }
};

/**
 * 指定した日付の画像ファイルを全てダウンロード
 */
export const downloadImagesByDate = async (date: string, downloadPath?: string) => {
  const files = await getImagesByDate(date);
  
  if (files.length === 0) {
    return { success: true, message: '指定した日付の画像ファイルは見つかりませんでした', files: [] };
  }

  // デフォルトのダウンロードパスを設定
  const basePath = downloadPath || path.join(process.cwd(), 'downloads');
  const dateFolder = path.join(basePath, date);

  const downloadedFiles: { name: string; path: string; size?: number }[] = [];
  const errors: { name: string; error: string }[] = [];

  for (const file of files) {
    if (!file.id || !file.name) continue;

    try {
      const downloadedPath = await downloadFileFromGoogleDrive(file.id, file.name, dateFolder);
      downloadedFiles.push({
        name: file.name,
        path: downloadedPath,
        size: file.size ? parseInt(file.size) : undefined,
      });
    } catch (error) {
      errors.push({
        name: file.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: true,
    message: `${downloadedFiles.length}件のファイルをダウンロードしました`,
    files: downloadedFiles,
    errors: errors.length > 0 ? errors : undefined,
    downloadPath: dateFolder,
  };
};

/**
 * 月単位で画像ファイルを取得
 */
export const getImagesByMonth = async (year: number, month: number) => {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
  
  return await getImagesByDateRange(startDate, endDate);
};

/**
 * 月単位で画像ファイルをダウンロード
 */
export const downloadImagesByMonth = async (year: number, month: number, downloadPath?: string) => {
  const files = await getImagesByMonth(year, month);
  
  if (files.length === 0) {
    return { 
      success: true, 
      message: `${year}年${month}月の画像ファイルは見つかりませんでした`, 
      files: [] 
    };
  }

  // デフォルトのダウンロードパスを設定
  const basePath = downloadPath || path.join(process.cwd(), 'downloads');
  const monthFolder = path.join(basePath, `${year}${month.toString().padStart(2, '0')}`);

  const downloadedFiles: { name: string; path: string; size?: number }[] = [];
  const errors: { name: string; error: string }[] = [];

  for (const file of files) {
    if (!file.id || !file.name) continue;

    try {
      const downloadedPath = await downloadFileFromGoogleDrive(file.id, file.name, monthFolder);
      downloadedFiles.push({
        name: file.name,
        path: downloadedPath,
        size: file.size ? parseInt(file.size) : undefined,
      });
    } catch (error) {
      errors.push({
        name: file.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: true,
    message: `${downloadedFiles.length}件のファイルをダウンロードしました`,
    files: downloadedFiles,
    errors: errors.length > 0 ? errors : undefined,
    downloadPath: monthFolder,
  };
};
