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
