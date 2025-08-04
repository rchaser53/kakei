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

  // クエリが指定されていない場合は全てのファイルを取得（ゴミ箱を除く）
  const searchQuery = query || "trashed = false";
  
  console.log('Google Drive API Query:', searchQuery);
  
  try {
    const res = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, createdTime, mimeType, size, parents, webViewLink)',
      orderBy: 'createdTime desc',
      pageSize: 1000,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    console.log('Google Drive API Response - Total files found:', res.data.files?.length || 0);
    if (res.data.files && res.data.files.length > 0) {
      console.log('First 5 files:', res.data.files.slice(0, 5).map(f => ({
        name: f.name,
        createdTime: f.createdTime,
        mimeType: f.mimeType,
        size: f.size
      })));
    }

    return res.data.files || [];
  } catch (error) {
    console.error('Google Drive API Error:', error);
    throw new Error(`Google Drive APIの呼び出しに失敗しました: ${error}`);
  }
};

/**
 * Google Drive上のフォルダ一覧を取得
 */
export const listGoogleDriveFolders = async () => {
  const query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  return await listGoogleDriveFiles(query);
};

/**
 * 指定したフォルダ内のファイル一覧を取得
 */
export const listFilesInFolder = async (folderId: string) => {
  const query = `'${folderId}' in parents and trashed = false`;
  return await listGoogleDriveFiles(query);
};

/**
 * Google Drive上の全ファイル・フォルダを階層構造で取得
 */
export const getAllFilesWithStructure = async () => {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    // すべてのファイルとフォルダを取得
    const res = await drive.files.list({
      q: "trashed = false",
      fields: 'files(id, name, createdTime, mimeType, size, parents, webViewLink)',
      pageSize: 1000,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const allFiles = res.data.files || [];
    
    console.log('Total files and folders found:', allFiles.length);
    
    // フォルダとファイルを分類
    const folders = allFiles.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
    const files = allFiles.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
    
    console.log('Folders found:', folders.length);
    console.log('Files found:', files.length);
    
    // フォルダの一覧を表示
    if (folders.length > 0) {
      console.log('Folder list:');
      folders.forEach(folder => {
        console.log(`- ${folder.name} (ID: ${folder.id})`);
      });
    }
    
    return {
      allFiles,
      folders,
      files,
      structure: buildFileStructure(allFiles)
    };
  } catch (error) {
    console.error('Error getting files with structure:', error);
    throw new Error(`ファイル構造の取得に失敗しました: ${error}`);
  }
};

/**
 * ファイル一覧から階層構造を構築
 */
const buildFileStructure = (files: any[]) => {
  const fileMap = new Map();
  const rootItems: any[] = [];
  
  // ファイルマップを作成
  files.forEach(file => {
    fileMap.set(file.id, {
      ...file,
      children: []
    });
  });
  
  // 階層構造を構築
  files.forEach(file => {
    const fileItem = fileMap.get(file.id);
    
    if (!file.parents || file.parents.length === 0) {
      // ルート要素
      rootItems.push(fileItem);
    } else {
      // 親要素に追加
      file.parents.forEach((parentId: string) => {
        const parent = fileMap.get(parentId);
        if (parent) {
          parent.children.push(fileItem);
        }
      });
    }
  });
  
  return rootItems;
};

/**
 * 指定した日付範囲のファイルを取得（すべてのファイル形式対応）
 */
export const getFilesByDateRange = async (startDate: string, endDate: string, includeAllTypes: boolean = false) => {
  // RFC 3339形式で日付範囲を指定
  const startDateTime = `${startDate}T00:00:00Z`;
  const endDateTime = `${endDate}T23:59:59Z`;
  
  console.log('Searching for files in range:', startDateTime, 'to', endDateTime);
  
  let query: string;
  if (includeAllTypes) {
    // すべてのファイル形式を取得（ゴミ箱以外）
    query = `trashed = false and createdTime >= '${startDateTime}' and createdTime <= '${endDateTime}'`;
  } else {
    // 従来通り画像・動画・PDF・ドキュメントファイルを取得
    query = `(mimeType contains 'image/' or mimeType contains 'video/' or mimeType contains 'pdf' or mimeType contains 'document' or mimeType contains 'text/' or mimeType contains 'application/') and trashed = false and createdTime >= '${startDateTime}' and createdTime <= '${endDateTime}'`;
  }
  
  return await listGoogleDriveFiles(query);
};

/**
 * 指定した日付範囲の画像ファイルを取得（後方互換性のため）
 */
export const getImagesByDateRange = async (startDate: string, endDate: string) => {
  // RFC 3339形式で日付範囲を指定
  const startDateTime = `${startDate}T00:00:00Z`;
  const endDateTime = `${endDate}T23:59:59Z`;
  
  console.log('Searching for images in range:', startDateTime, 'to', endDateTime);
  
  const query = `(mimeType contains 'image/' or mimeType contains 'video/') and trashed = false and createdTime >= '${startDateTime}' and createdTime <= '${endDateTime}'`;
  return await listGoogleDriveFiles(query);
};

/**
 * 指定した日付のファイルを取得（すべてのファイル形式対応）
 */
export const getFilesByDate = async (date: string, includeAllTypes: boolean = false) => {
  // RFC 3339形式で日付範囲を指定
  const startDateTime = `${date}T00:00:00Z`;
  const endDateTime = `${date}T23:59:59Z`;
  
  console.log('Searching for files between:', startDateTime, 'and', endDateTime);
  
  let query: string;
  if (includeAllTypes) {
    // すべてのファイル形式を取得
    query = `trashed = false and createdTime >= '${startDateTime}' and createdTime <= '${endDateTime}'`;
  } else {
    // 画像・動画・PDF・ドキュメントファイルを取得
    query = `(mimeType contains 'image/' or mimeType contains 'video/' or mimeType contains 'pdf' or mimeType contains 'document' or mimeType contains 'text/' or mimeType contains 'application/') and trashed = false and createdTime >= '${startDateTime}' and createdTime <= '${endDateTime}'`;
  }
  
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
    
    let broadQuery: string;
    if (includeAllTypes) {
      broadQuery = `trashed = false and createdTime >= '${broadStartDateTime}' and createdTime <= '${broadEndDateTime}'`;
    } else {
      broadQuery = `(mimeType contains 'image/' or mimeType contains 'video/' or mimeType contains 'pdf' or mimeType contains 'document' or mimeType contains 'text/' or mimeType contains 'application/') and trashed = false and createdTime >= '${broadStartDateTime}' and createdTime <= '${broadEndDateTime}'`;
    }
    
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
 * 指定した日付の画像ファイルを取得（後方互換性のため）
 */
export const getImagesByDate = async (date: string) => {
  // RFC 3339形式で日付範囲を指定
  const startDateTime = `${date}T00:00:00Z`;
  const endDateTime = `${date}T23:59:59Z`;
  
  console.log('Searching for images between:', startDateTime, 'and', endDateTime);
  
  // Google Drive APIのクエリ構文に従って修正
  const query = `(mimeType contains 'image/' or mimeType contains 'video/') and trashed = false and createdTime >= '${startDateTime}' and createdTime <= '${endDateTime}'`;
  
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
    
    const broadQuery = `(mimeType contains 'image/' or mimeType contains 'video/') and trashed = false and createdTime >= '${broadStartDateTime}' and createdTime <= '${broadEndDateTime}'`;
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
 * 指定した日付のファイルを全てダウンロード（すべてのファイル形式対応）
 */
export const downloadFilesByDate = async (date: string, downloadPath?: string, includeAllTypes: boolean = false) => {
  const files = await getFilesByDate(date, includeAllTypes);
  
  if (files.length === 0) {
    return { 
      success: true, 
      message: includeAllTypes 
        ? '指定した日付のファイルは見つかりませんでした' 
        : '指定した日付の画像・ドキュメントファイルは見つかりませんでした', 
      files: [] 
    };
  }

  // デフォルトのダウンロードパスを設定
  const basePath = downloadPath || path.join(process.cwd(), 'downloads');
  const dateFolder = path.join(basePath, date);

  const downloadedFiles: { name: string; path: string; size?: number; mimeType?: string }[] = [];
  const errors: { name: string; error: string }[] = [];

  console.log(`Found ${files.length} files for date ${date}`);
  
  // ファイルタイプ別の統計
  const fileTypes = files.reduce((acc, file) => {
    const type = file.mimeType || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('File types found:', fileTypes);

  for (const file of files) {
    if (!file.id || !file.name) continue;

    try {
      const downloadedPath = await downloadFileFromGoogleDrive(file.id, file.name, dateFolder);
      downloadedFiles.push({
        name: file.name,
        path: downloadedPath,
        size: file.size ? parseInt(file.size) : undefined,
        mimeType: file.mimeType || undefined,
      });
    } catch (error) {
      console.error(`Failed to download ${file.name}:`, error);
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
    fileTypes,
  };
};

/**
 * 指定した日付の画像ファイルを全てダウンロード（後方互換性のため）
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
 * Google Drive上のすべてのMIMEタイプを調査
 */
export const investigateFileTypes = async () => {
  console.log('Investigating all file types in Google Drive...');
  
  const allFiles = await listGoogleDriveFiles("trashed = false");
  
  const mimeTypeStats = allFiles.reduce((acc, file) => {
    const mimeType = file.mimeType || 'unknown';
    if (!acc[mimeType]) {
      acc[mimeType] = {
        count: 0,
        examples: []
      };
    }
    acc[mimeType].count++;
    if (acc[mimeType].examples.length < 3) {
      acc[mimeType].examples.push(file.name || 'unnamed');
    }
    return acc;
  }, {} as Record<string, { count: number; examples: string[] }>);
  
  console.log('MIME Type Statistics:');
  Object.entries(mimeTypeStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([mimeType, stats]) => {
      console.log(`${mimeType}: ${stats.count} files`);
      console.log(`  Examples: ${stats.examples.join(', ')}`);
    });
  
  // PDFファイルを特別に検索
  const pdfFiles = allFiles.filter(file => 
    file.mimeType?.includes('pdf') || 
    file.name?.toLowerCase().endsWith('.pdf')
  );
  
  console.log(`\nPDF Files found: ${pdfFiles.length}`);
  if (pdfFiles.length > 0) {
    console.log('PDF Examples:');
    pdfFiles.slice(0, 5).forEach(file => {
      console.log(`- ${file.name} (${file.mimeType}) - Created: ${file.createdTime}`);
    });
  }
  
  return {
    totalFiles: allFiles.length,
    mimeTypeStats,
    pdfFiles: pdfFiles.length,
    allFiles: allFiles.slice(0, 10) // 最初の10ファイルのサンプル
  };
};

/**
 * 指定した日付範囲でMIMEタイプを調査
 */
export const investigateFileTypesByDateRange = async (startDate: string, endDate: string) => {
  console.log(`Investigating file types between ${startDate} and ${endDate}...`);
  
  const files = await getFilesByDateRange(startDate, endDate, true); // すべてのファイル形式
  
  const mimeTypeStats = files.reduce((acc, file) => {
    const mimeType = file.mimeType || 'unknown';
    if (!acc[mimeType]) {
      acc[mimeType] = {
        count: 0,
        examples: []
      };
    }
    acc[mimeType].count++;
    if (acc[mimeType].examples.length < 3) {
      acc[mimeType].examples.push(file.name || 'unnamed');
    }
    return acc;
  }, {} as Record<string, { count: number; examples: string[] }>);
  
  console.log(`Found ${files.length} files in date range`);
  console.log('MIME Type Statistics for date range:');
  Object.entries(mimeTypeStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([mimeType, stats]) => {
      console.log(`${mimeType}: ${stats.count} files`);
      console.log(`  Examples: ${stats.examples.join(', ')}`);
    });
  
  return {
    totalFiles: files.length,
    mimeTypeStats,
    dateRange: { startDate, endDate },
    sampleFiles: files.slice(0, 10)
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
