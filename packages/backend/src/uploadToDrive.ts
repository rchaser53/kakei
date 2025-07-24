

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = path.join(__dirname, '../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');

// 認証情報を保存
const saveCredentials = async (client: any) => {
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
const loadSavedCredentialsIfExist = async (): Promise<any> => {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
};

// 認証を行う
const authorize = async (): Promise<any> => {
  let client = await loadSavedCredentialsIfExist();
  if (client) return client;
  client = await authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });
  if (client && client.credentials) {
    await saveCredentials(client);
  }
  return client;
};

async function uploadFile(auth: any, filePath: string): Promise<any> {
  const drive = google.drive({ version: 'v3', auth });
  const fileMetadata = { name: path.basename(filePath) };
  const media = { mimeType: 'application/octet-stream', body: (await import('fs')).createReadStream(filePath) };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });
  return res.data;
}

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

  const auth = await authorize();

  try {
    const result = await uploadFile(auth, filePath);
    console.log('File uploaded! File ID:', result.id);
    console.log('View link:', result.webViewLink);
  } catch (err: any) {
    if (err.errors && err.errors[0] && err.errors[0].reason === 'insufficientPermissions') {
      console.error('Google Drive APIの権限が不足しています。credentials.jsonのスコープ、token.jsonの再生成、Google Cloud Consoleの設定を確認してください。');
      console.error('必要なスコープ:', SCOPES);
    }
    console.error('Upload failed:', err);
  }
}

main();
