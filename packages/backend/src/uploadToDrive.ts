
import fs from 'fs/promises';
import { uploadToGoogleDrive } from './upload-service.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: ts-node uploadToDrive.ts <file_path>');
    process.exit(1);
  }
  
  try {
    // ファイル存在チェック
    await fs.access(filePath);
  } catch {
    console.error('指定したファイルが存在しません:', filePath);
    process.exit(1);
  }

  try {
    const result = await uploadToGoogleDrive(filePath);
    console.log('File uploaded! File ID:', result.id);
    console.log('View link:', result.webViewLink);
  } catch (err: any) {
    if (err.errors && err.errors[0] && err.errors[0].reason === 'insufficientPermissions') {
      console.error('Google Drive APIの権限が不足しています。credentials.jsonのスコープ、token.jsonの再生成、Google Cloud Consoleの設定を確認してください。');
    }
    console.error('Upload failed:', err);
  }
}

main();
