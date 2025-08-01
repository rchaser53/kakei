<template>
  <div class="backup-page">
    <h2>データベースバックアップ・復元</h2>
    
    <!-- アップロード機能 -->
    <div class="upload-section">
      <h3>📤 データベースアップロード</h3>
      <p>データベースをGoogle Driveにバックアップできます。</p>
      
      <div class="upload-form">
        <div class="input-group">
          <label for="fileName">ファイル名:</label>
          <input 
            id="fileName"
            v-model="fileName" 
            type="text" 
            placeholder="backup-database.sqlite"
            :disabled="isUploading"
          />
        </div>
        
        <button 
          @click="uploadToGoogleDrive" 
          :disabled="isUploading || !fileName.trim()"
          class="action-btn upload-btn"
        >
          <span v-if="isUploading">アップロード中...</span>
          <span v-else>Google Driveにアップロード</span>
        </button>
      </div>

      <div v-if="uploadResult" class="result">
        <div v-if="uploadResult.success" class="success-message">
          <h4>✅ アップロード成功</h4>
          <p>{{ uploadResult.message }}</p>
          <p>
            <a :href="uploadResult.webViewLink" target="_blank" class="drive-link">
              Google Driveで開く
            </a>
          </p>
        </div>
        
        <div v-else class="error-message">
          <h4>❌ アップロード失敗</h4>
          <p>{{ uploadResult.error }}</p>
          <p v-if="uploadResult.details" class="error-details">
            詳細: {{ uploadResult.details }}
          </p>
        </div>
      </div>
    </div>

    <!-- ダウンロード機能 -->
    <GoogleDriveDownload />

    <div v-if="isUploading" class="loading-spinner">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import GoogleDriveDownload from './GoogleDriveDownload.vue';

interface UploadResult {
  success: boolean;
  message?: string;
  fileId?: string;
  webViewLink?: string;
  error?: string;
  details?: string;
}

const fileName = ref('');
const isUploading = ref(false);
const uploadResult = ref<UploadResult | null>(null);

// デフォルトのファイル名を設定（現在の日時付き）
const setDefaultFileName = () => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  fileName.value = `backup-database-${dateStr}-${timeStr}.sqlite`;
};

// コンポーネント初期化時にデフォルトファイル名を設定
setDefaultFileName();

const uploadToGoogleDrive = async () => {
  if (!fileName.value.trim()) {
    alert('ファイル名を入力してください');
    return;
  }

  isUploading.value = true;
  uploadResult.value = null;

  try {
    const response = await fetch('/api/upload/drive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: fileName.value.trim()
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      uploadResult.value = {
        success: true,
        message: data.message,
        fileId: data.fileId,
        webViewLink: data.webViewLink
      };
    } else {
      uploadResult.value = {
        success: false,
        error: data.error || 'アップロードに失敗しました',
        details: data.details
      };
    }
  } catch (error) {
    console.error('アップロードエラー:', error);
    uploadResult.value = {
      success: false,
      error: 'ネットワークエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    };
  } finally {
    isUploading.value = false;
  }
};
</script>

<style scoped>
.backup-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.backup-page h2 {
  text-align: center;
  color: #333;
  margin-bottom: 2rem;
}

.upload-section {
  background: #f9f9f9;
  padding: 20px;
  margin-bottom: 30px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.upload-section h3 {
  color: #333;
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.upload-section p {
  color: #666;
  margin-bottom: 1.5rem;
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-group label {
  font-weight: bold;
  color: #333;
}

.input-group input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.input-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.action-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.upload-btn {
  background: #4285f4;
  color: white;
}

.upload-btn:hover:not(:disabled) {
  background: #3367d6;
}

.upload-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.result {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 4px;
}

.success-message {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.success-message h4,
.error-message h4 {
  margin: 0 0 0.5rem 0;
}

.drive-link {
  color: #4285f4;
  text-decoration: none;
  font-weight: bold;
}

.drive-link:hover {
  text-decoration: underline;
}

.error-details {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  opacity: 0.8;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4285f4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .backup-page {
    padding: 10px;
  }
  
  .upload-section {
    padding: 15px;
  }
  
  .upload-form {
    gap: 1rem;
  }
}
</style>
