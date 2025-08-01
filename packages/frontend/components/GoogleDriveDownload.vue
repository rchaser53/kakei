<template>
  <div class="google-drive-download">
    <h2>Google Drive 画像ダウンロード</h2>
    
    <!-- デバッグセクション -->
    <div class="debug-section">
      <h3>🔧 デバッグ機能</h3>
      <button @click="showAllFiles" :disabled="isSearching">
        {{ isSearching ? '検索中...' : 'Google Drive上の全ファイルを表示' }}
      </button>
      
      <div v-if="allFiles.length > 0" class="debug-result">
        <h4>Google Drive上のファイル (最新10件)</h4>
        <div class="file-list">
          <div v-for="file in allFiles.slice(0, 10)" :key="file.id" class="file-item">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <span class="file-date">{{ formatDate(file.createdTime) }}</span>
            <span class="file-type">{{ file.mimeType }}</span>
          </div>
        </div>
        <p v-if="allFiles.length > 10" class="more-files">
          ...他 {{ allFiles.length - 10 }} 件
        </p>
      </div>
    </div>
    
    <div class="download-section">
      <h3>指定日の画像をダウンロード</h3>
      <div class="date-input-group">
        <label for="downloadDate">日付:</label>
        <input
          id="downloadDate"
          type="date"
          v-model="selectedDate"
          :max="today"
        />
        <button @click="searchFilesByDate" :disabled="!selectedDate || isSearching">
          {{ isSearching ? '検索中...' : 'ファイル検索' }}
        </button>
        <button 
          @click="downloadByDate" 
          :disabled="!selectedDate || isDownloading || searchResult.files.length === 0"
        >
          {{ isDownloading ? 'ダウンロード中...' : 'ダウンロード開始' }}
        </button>
      </div>
      
      <!-- 検索結果表示 -->
      <div v-if="searchResult.searched" class="search-result">
        <h4>検索結果: {{ searchResult.files.length }}件のファイル</h4>
        <div v-if="searchResult.files.length > 0" class="file-list">
          <div v-for="file in searchResult.files.slice(0, 10)" :key="file.id" class="file-item">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <span class="file-date">{{ formatDate(file.createdTime) }}</span>
          </div>
          <p v-if="searchResult.files.length > 10" class="more-files">
            ...他 {{ searchResult.files.length - 10 }} 件
          </p>
        </div>
        <p v-else class="no-files">指定した日付の画像ファイルは見つかりませんでした。</p>
      </div>
    </div>

    <div class="download-section">
      <h3>月単位で画像をダウンロード</h3>
      <div class="month-input-group">
        <label for="downloadYear">年:</label>
        <input
          id="downloadYear"
          type="number"
          v-model.number="selectedYear"
          :min="2020"
          :max="currentYear"
          placeholder="例: 2025"
        />
        <label for="downloadMonth">月:</label>
        <select id="downloadMonth" v-model.number="selectedMonth">
          <option value="">月を選択</option>
          <option v-for="month in 12" :key="month" :value="month">{{ month }}月</option>
        </select>
        <button @click="searchFilesByMonth" :disabled="!selectedYear || !selectedMonth || isSearching">
          {{ isSearching ? '検索中...' : 'ファイル検索' }}
        </button>
        <button 
          @click="downloadByMonth" 
          :disabled="!selectedYear || !selectedMonth || isDownloading || monthSearchResult.files.length === 0"
        >
          {{ isDownloading ? 'ダウンロード中...' : 'ダウンロード開始' }}
        </button>
      </div>
      
      <!-- 月検索結果表示 -->
      <div v-if="monthSearchResult.searched" class="search-result">
        <h4>{{ selectedYear }}年{{ selectedMonth }}月の検索結果: {{ monthSearchResult.files.length }}件のファイル</h4>
        <div v-if="monthSearchResult.files.length > 0" class="file-list">
          <div v-for="file in monthSearchResult.files.slice(0, 10)" :key="file.id" class="file-item">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <span class="file-date">{{ formatDate(file.createdTime) }}</span>
          </div>
          <p v-if="monthSearchResult.files.length > 10" class="more-files">
            ...他 {{ monthSearchResult.files.length - 10 }} 件
          </p>
        </div>
        <p v-else class="no-files">指定した月の画像ファイルは見つかりませんでした。</p>
      </div>
    </div>

    <!-- ダウンロード結果表示 -->
    <div v-if="downloadResult" class="download-result">
      <h3>ダウンロード結果</h3>
      <div class="result-message" :class="downloadResult.success ? 'success' : 'error'">
        {{ downloadResult.message }}
      </div>
      
      <div v-if="downloadResult.success && downloadResult.files && downloadResult.files.length > 0">
        <p><strong>ダウンロード先:</strong> {{ downloadResult.downloadPath }}</p>
        <p><strong>ダウンロードファイル数:</strong> {{ downloadResult.files.length }}件</p>
        
        <details class="downloaded-files">
          <summary>ダウンロードしたファイル一覧</summary>
          <div class="file-list">
            <div v-for="file in downloadResult.files" :key="file.name" class="file-item">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
            </div>
          </div>
        </details>
      </div>
      
      <div v-if="downloadResult.errors && downloadResult.errors.length > 0" class="errors">
        <h4>エラーが発生したファイル:</h4>
        <div v-for="error in downloadResult.errors" :key="error.name" class="error-item">
          <span class="file-name">{{ error.name }}</span>
          <span class="error-message">{{ error.error }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
  mimeType?: string;
  size?: string;
}

interface DownloadResult {
  success: boolean;
  message: string;
  files?: { name: string; path: string; size?: number }[];
  errors?: { name: string; error: string }[];
  downloadPath?: string;
}

interface SearchResult {
  searched: boolean;
  files: DriveFile[];
}

const selectedDate = ref('');
const selectedYear = ref<number>(new Date().getFullYear());
const selectedMonth = ref<number | ''>('');
const isDownloading = ref(false);
const isSearching = ref(false);
const downloadResult = ref<DownloadResult | null>(null);
const searchResult = ref<SearchResult>({ searched: false, files: [] });
const monthSearchResult = ref<SearchResult>({ searched: false, files: [] });
const allFiles = ref<DriveFile[]>([]);

const today = computed(() => {
  return new Date().toISOString().split('T')[0];
});

const currentYear = computed(() => {
  return new Date().getFullYear();
});

// デフォルト値を設定
onMounted(() => {
  const now = new Date();
  selectedDate.value = now.toISOString().split('T')[0];
  selectedMonth.value = now.getMonth() + 1;
});

// デバッグ用: 全ファイル表示
const showAllFiles = async () => {
  isSearching.value = true;
  allFiles.value = [];

  try {
    const response = await fetch('/api/drive/files/all');
    
    if (response.status === 401) {
      window.location.reload();
      return;
    }

    const data = await response.json();
    
    if (data.success) {
      allFiles.value = data.files || [];
      console.log('All files from Google Drive:', data.files);
    } else {
      throw new Error(data.error || 'ファイル取得に失敗しました');
    }
  } catch (error) {
    console.error('ファイル取得エラー:', error);
    alert('ファイル取得に失敗しました');
  } finally {
    isSearching.value = false;
  }
};

// 指定日のファイル検索
const searchFilesByDate = async () => {
  if (!selectedDate.value) return;

  isSearching.value = true;
  searchResult.value = { searched: false, files: [] };

  try {
    const response = await fetch(`/api/drive/files/date/${selectedDate.value}`);
    
    if (response.status === 401) {
      window.location.reload();
      return;
    }

    const data = await response.json();
    
    if (data.success) {
      searchResult.value = {
        searched: true,
        files: data.files || []
      };
    } else {
      throw new Error(data.error || 'ファイル検索に失敗しました');
    }
  } catch (error) {
    console.error('ファイル検索エラー:', error);
    alert('ファイル検索に失敗しました');
    searchResult.value = { searched: true, files: [] };
  } finally {
    isSearching.value = false;
  }
};

// 月単位のファイル検索
const searchFilesByMonth = async () => {
  if (!selectedYear.value || !selectedMonth.value) return;

  isSearching.value = true;
  monthSearchResult.value = { searched: false, files: [] };

  try {
    const response = await fetch(`/api/drive/files/month/${selectedYear.value}/${selectedMonth.value}`);
    
    if (response.status === 401) {
      window.location.reload();
      return;
    }

    const data = await response.json();
    
    if (data.success) {
      monthSearchResult.value = {
        searched: true,
        files: data.files || []
      };
    } else {
      throw new Error(data.error || 'ファイル検索に失敗しました');
    }
  } catch (error) {
    console.error('ファイル検索エラー:', error);
    alert('ファイル検索に失敗しました');
    monthSearchResult.value = { searched: true, files: [] };
  } finally {
    isSearching.value = false;
  }
};

// 日付指定ダウンロード
const downloadByDate = async () => {
  if (!selectedDate.value) {
    alert('日付を選択してください');
    return;
  }

  isDownloading.value = true;
  downloadResult.value = null;

  try {
    const response = await fetch('/api/drive/download/date', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: selectedDate.value,
      }),
    });

    if (response.status === 401) {
      window.location.reload();
      return;
    }

    const result = await response.json();
    
    if (result.success) {
      downloadResult.value = result;
    } else {
      throw new Error(result.error || 'ダウンロードに失敗しました');
    }
  } catch (error) {
    console.error('ダウンロードエラー:', error);
    downloadResult.value = {
      success: false,
      message: error instanceof Error ? error.message : 'ダウンロードに失敗しました',
    };
  } finally {
    isDownloading.value = false;
  }
};

// 月指定ダウンロード
const downloadByMonth = async () => {
  if (!selectedYear.value || !selectedMonth.value) {
    alert('年と月を選択してください');
    return;
  }

  isDownloading.value = true;
  downloadResult.value = null;

  try {
    const response = await fetch('/api/drive/download/month', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        year: selectedYear.value,
        month: selectedMonth.value,
      }),
    });

    if (response.status === 401) {
      window.location.reload();
      return;
    }

    const result = await response.json();
    
    if (result.success) {
      downloadResult.value = result;
    } else {
      throw new Error(result.error || 'ダウンロードに失敗しました');
    }
  } catch (error) {
    console.error('ダウンロードエラー:', error);
    downloadResult.value = {
      success: false,
      message: error instanceof Error ? error.message : 'ダウンロードに失敗しました',
    };
  } finally {
    isDownloading.value = false;
  }
};

// ファイルサイズのフォーマット
const formatFileSize = (size?: string | number): string => {
  if (!size) return '-';
  
  const bytes = typeof size === 'string' ? parseInt(size) : size;
  if (isNaN(bytes)) return '-';
  
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 日付のフォーマット
const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};
</script>

<style scoped>
.google-drive-download {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.download-section {
  background: #f9f9f9;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.debug-section {
  background: #fff3cd;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 8px;
  border: 1px solid #ffeaa7;
}

.debug-section h3 {
  margin-top: 0;
  color: #856404;
}

.debug-result {
  margin-top: 15px;
  padding: 15px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.download-section h3 {
  margin-top: 0;
  color: #333;
}

.date-input-group,
.month-input-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.date-input-group label,
.month-input-group label {
  font-weight: bold;
  min-width: 40px;
}

.date-input-group input,
.month-input-group input,
.month-input-group select {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.date-input-group button,
.month-input-group button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

.date-input-group button:hover:not(:disabled),
.month-input-group button:hover:not(:disabled) {
  background: #0056b3;
}

.date-input-group button:disabled,
.month-input-group button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.search-result {
  margin-top: 20px;
  padding: 15px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.search-result h4 {
  margin-top: 0;
  color: #333;
}

.file-list {
  max-height: 300px;
  overflow-y: auto;
}

.file-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 10px;
  padding: 8px;
  border-bottom: 1px solid #eee;
  align-items: center;
  font-size: 0.9em;
}

.file-name {
  font-weight: bold;
  word-break: break-all;
}

.file-size {
  color: #666;
  text-align: right;
}

.file-date {
  color: #666;
  font-size: 0.9em;
  text-align: right;
}

.file-type {
  color: #888;
  font-size: 0.8em;
  text-align: right;
  font-family: monospace;
}

.more-files {
  color: #666;
  font-style: italic;
  text-align: center;
  margin: 10px 0;
}

.no-files {
  color: #666;
  text-align: center;
  margin: 20px 0;
}

.download-result {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  margin-top: 20px;
}

.result-message {
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-weight: bold;
}

.result-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.result-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.downloaded-files {
  margin-top: 15px;
}

.downloaded-files summary {
  cursor: pointer;
  font-weight: bold;
  margin-bottom: 10px;
}

.errors {
  margin-top: 15px;
  padding: 15px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.errors h4 {
  margin-top: 0;
  color: #721c24;
}

.error-item {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px solid #f5c6cb;
}

.error-message {
  color: #721c24;
  font-size: 0.9em;
}

@media (max-width: 768px) {
  .date-input-group,
  .month-input-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .file-item {
    grid-template-columns: 1fr;
    text-align: left;
  }
  
  .file-type {
    display: none;
  }
}
</style>
