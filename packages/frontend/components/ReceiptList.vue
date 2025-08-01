<template>
  <div class="receipts-section">
    <h2>レシート一覧</h2>
    <MonthSelector v-model="selectedMonth" />
    
    <!-- 店舗名絞り込み -->
    <div class="filter-section">
      <label for="store-filter">店舗名で絞り込み:</label>
      <input 
        id="store-filter"
        v-model="storeNameFilter" 
        type="text" 
        placeholder="店舗名を入力してください"
        class="store-filter-input"
        @input="onStoreFilterChange"
      />
      <button @click="clearFilter" class="clear-filter-btn" type="button">
        クリア
      </button>
    </div>
    
    <!-- 削除モード切替と一括削除ボタン -->
    <div class="action-bar" v-if="receipts.length > 0">
      <!-- デバッグ情報 -->
      <div style="margin-bottom: 0.5rem; font-size: 0.8rem; color: #666; padding: 0.5rem; background: #f0f0f0; border-radius: 4px;">
        <div>削除モード: {{ deleteMode }} ({{ typeof deleteMode }})</div>
        <div>レシート数: {{ receipts.length }}</div>
        <div>選択されたID: {{ selectedReceiptIds }}</div>
        <div>全選択状態: {{ allSelected }}</div>
      </div>
      <div class="mode-toggle">
        <button @click.prevent="toggleDeleteMode" :class="{ active: deleteMode }" type="button">
          {{ deleteMode ? '削除モード終了' : '削除モード' }}
        </button>
      </div>
      <div class="bulk-actions" v-if="deleteMode">
        <button @click.prevent="selectAll" :class="{ active: allSelected }" type="button">
          {{ allSelected ? '全て解除' : '全て選択' }}
        </button>
        <button @click.prevent="deleteSelected" :disabled="selectedReceiptIds.length === 0" class="delete-btn" type="button">
          選択した項目を削除 ({{ selectedReceiptIds.length }})
        </button>
      </div>
    </div>

    <div class="receipts-container">
      <div v-if="loading" class="loading">データを読み込み中...</div>
      <div v-else-if="receipts.length === 0" class="no-data">{{ noDataMessage }}</div>
      <div v-else>
        <div v-for="receipt in receipts" :key="receipt.id" class="receipt-card" :class="{ selected: selectedReceiptIds.includes(receipt.id) }">
          <!-- 削除モード時のチェックボックス -->
          <div class="receipt-select" v-if="deleteMode">
            <input 
              type="checkbox" 
              :value="receipt.id" 
              v-model="selectedReceiptIds"
              class="select-checkbox"
            />
          </div>
          
          <div class="receipt-content">
            <div class="receipt-header">
              <div class="receipt-date">{{ formatDate(receipt.receipt_date || receipt.created_at) }}</div>
              <div class="receipt-id">レシートID: {{ receipt.id }}</div>
            </div>
            <div class="receipt-details">
              <div class="receipt-store">{{ receipt.store_name }}</div>
              <div class="receipt-amount">{{ receipt.total_amount.toLocaleString() }}円</div>
            </div>
            <div class="receipt-actions">
              <div class="receipt-use-image">
                <label>
                  <input type="checkbox" v-model="receipt.use_image" @change="toggleUseImage(receipt)" />
                  手動入力
                </label>
              </div>
              <!-- 個別削除ボタン -->
              <button v-if="!deleteMode" @click.prevent="deleteReceipt(receipt.id)" class="delete-single-btn" type="button">
                削除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, nextTick } from 'vue';
import MonthSelector from './MonthSelector.vue';

const receipts = ref<any[]>([]);
const allReceipts = ref<any[]>([]); // 全レシートを保持
const loading = ref<boolean>(false);
const noDataMessage = ref<string>('');

// 月選択の初期値は空文字に設定（MonthSelectorが最新月を設定する）
const selectedMonth = ref<string>('');

// 店舗名フィルター
const storeNameFilter = ref<string>('');

const deleteMode = ref<boolean>(false);
const selectedReceiptIds = ref<number[]>([]);

// 全選択状態の計算
const allSelected = computed(() => {
  return receipts.value.length > 0 && selectedReceiptIds.value.length === receipts.value.length;
});

// フィルタリングされたレシート（computed）
const filteredReceipts = computed(() => {
  if (!storeNameFilter.value || storeNameFilter.value.trim() === '') {
    return allReceipts.value;
  }
  
  const filterText = storeNameFilter.value.trim().toLowerCase();
  return allReceipts.value.filter(receipt => 
    receipt.store_name.toLowerCase().includes(filterText)
  );
});

// receiptsをfilteredReceiptsと同期
watch(filteredReceipts, (newFilteredReceipts) => {
  receipts.value = newFilteredReceipts;
  
  // フィルター結果に応じてメッセージを更新
  if (newFilteredReceipts.length === 0) {
    if (storeNameFilter.value && storeNameFilter.value.trim() !== '') {
      noDataMessage.value = `「${storeNameFilter.value}」に一致するレシートはありません`;
    } else if (allReceipts.value.length === 0) {
      noDataMessage.value = 'この月のレシート情報はありません';
    } else {
      noDataMessage.value = '';
    }
  } else {
    noDataMessage.value = '';
  }
});

const formatDate = (dateString: string) => {
  if (!dateString) {
    return '日付なし';
  }
  const date = new Date(dateString);
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
};

// 店舗名フィルターのクリア
const clearFilter = () => {
  storeNameFilter.value = '';
};

// 店舗名フィルターの変更時（即座に反映）
const onStoreFilterChange = () => {
  // computedが自動的に更新されるため、特別な処理は不要
};

// 削除モードの切り替え
const toggleDeleteMode = () => {
  console.log('削除モード切り替え開始');
  
  // 現在の値を取得
  const currentMode = deleteMode.value;
  console.log('現在のモード:', currentMode);
  
  // 新しい値を設定
  const newMode = !currentMode;
  deleteMode.value = newMode;
  
  console.log('新しいモード:', deleteMode.value);
  
  // リアクティブシステムの更新を確認
  nextTick(() => {
    console.log('nextTick - モード:', deleteMode.value);
    console.log('DOM更新後のボタンテキスト要素の有無を確認');
  });
  
  // 削除モードを終了する場合は選択をクリア
  if (!newMode) {
    selectedReceiptIds.value = [];
    console.log('選択をクリア');
  }
};

// 全選択/全解除
const selectAll = () => {
  if (allSelected.value) {
    selectedReceiptIds.value = [];
  } else {
    selectedReceiptIds.value = receipts.value.map(receipt => receipt.id);
  }
};

// 個別削除
const deleteReceipt = async (id: number) => {
  if (!confirm('このレシートを削除しますか？')) {
    return;
  }

  try {
    const response = await fetch(`/api/receipts/${id}`, {
      method: 'DELETE'
    });
    
    if (handleAuthError(response)) return;
    
    if (!response.ok) {
      throw new Error('削除に失敗しました');
    }
    
    const result = await response.json();
    alert(result.message);
    
    // リストを再読み込み
    await fetchReceipts();
  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除に失敗しました');
  }
};

// 選択したレシートを一括削除
const deleteSelected = async () => {
  if (selectedReceiptIds.value.length === 0) {
    return;
  }

  if (!confirm(`選択した${selectedReceiptIds.value.length}件のレシートを削除しますか？`)) {
    return;
  }

  try {
    const response = await fetch('/api/receipts', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: selectedReceiptIds.value })
    });
    
    if (handleAuthError(response)) return;
    
    if (!response.ok) {
      throw new Error('一括削除に失敗しました');
    }
    
    const result = await response.json();
    alert(result.message);
    
    // 選択をクリアして削除モードを終了
    selectedReceiptIds.value = [];
    deleteMode.value = false;
    
    // リストを再読み込み
    await fetchReceipts();
  } catch (error) {
    console.error('一括削除エラー:', error);
    alert('一括削除に失敗しました');
  }
};

// 認証エラーをチェックして必要に応じてリダイレクトする関数
const handleAuthError = (response: Response) => {
  if (response.status === 401) {
    window.location.reload();
    return true;
  }
  return false;
};

const fetchReceipts = async () => {
  if (!selectedMonth.value) {
    allReceipts.value = [];
    receipts.value = [];
    noDataMessage.value = '月を選択してください';
    return;
  }
  const [year, month] = selectedMonth.value.split('-').map(Number);
  loading.value = true;
  try {
    const res = await fetch(`/api/receipts/${year}/${month}`);
    
    if (handleAuthError(res)) return;
    
    const data = await res.json();
    allReceipts.value = data.receipts;
    // filteredReceiptsのwatcherによってreceiptsが自動更新される
    
  } catch (e) {
    allReceipts.value = [];
    receipts.value = [];
    noDataMessage.value = 'データの取得中にエラーが発生しました';
  } finally {
    loading.value = false;
  }
};

const toggleUseImage = async (receipt: any) => {
  const newValue = receipt.use_image;
  try {
    const response = await fetch(`/api/receipts/${receipt.image_hash}/use-image`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_image: newValue })
    });
    
    if (handleAuthError(response)) return;
    
    if (!response.ok) throw new Error('更新に失敗しました');
  } catch (e) {
    alert('use_imageの更新に失敗しました');
  }
};

onMounted(fetchReceipts);
watch(selectedMonth, fetchReceipts);
</script>

<style scoped>
.receipts-section { margin-top: 2rem; }

/* 店舗名フィルターセクション */
.filter-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.filter-section label {
  font-weight: bold;
  color: #495057;
  white-space: nowrap;
}

.store-filter-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
}

.store-filter-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
}

.clear-filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #6c757d;
  background: #fff;
  color: #6c757d;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  white-space: nowrap;
}

.clear-filter-btn:hover {
  background: #6c757d;
  color: #fff;
}

/* アクションバー */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.mode-toggle button {
  padding: 0.5rem 1rem;
  border: 1px solid #007bff;
  background: #fff;
  color: #007bff;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.mode-toggle button.active {
  background: #007bff;
  color: #fff;
}

.bulk-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.bulk-actions button {
  padding: 0.5rem 1rem;
  border: 1px solid #6c757d;
  background: #fff;
  color: #6c757d;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.bulk-actions button.active {
  background: #6c757d;
  color: #fff;
}

.bulk-actions button.delete-btn {
  border-color: #dc3545;
  color: #dc3545;
}

.bulk-actions button.delete-btn:not(:disabled):hover {
  background: #dc3545;
  color: #fff;
}

.bulk-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* レシートカード */
.receipts-container { 
  display: flex; 
  flex-direction: column; 
  gap: 15px; 
}

.receipt-card { 
  border: 1px solid #ddd; 
  border-radius: 6px; 
  padding: 15px; 
  background: #fff;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  transition: border-color 0.2s;
}

.receipt-card.selected {
  border-color: #007bff;
  background: #f8f9ff;
}

.receipt-select {
  display: flex;
  align-items: center;
  padding-top: 0.5rem;
}

.select-checkbox {
  transform: scale(1.2);
}

.receipt-content {
  flex: 1;
}

.receipt-header { 
  display: flex; 
  justify-content: space-between; 
  margin-bottom: 10px; 
  border-bottom: 1px solid #eee; 
  padding-bottom: 10px;
}

.receipt-date { 
  font-weight: bold; 
  color: #7f8c8d; 
}

.receipt-id { 
  color: #95a5a6; 
  font-size: 14px; 
}

.receipt-details { 
  margin-bottom: 15px; 
}

.receipt-store { 
  font-weight: bold; 
  margin-bottom: 5px; 
}

.receipt-amount { 
  text-align: right; 
  font-weight: bold; 
  color: #e74c3c; 
}

.receipt-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.delete-single-btn {
  padding: 0.3rem 0.8rem;
  border: 1px solid #dc3545;
  background: #fff;
  color: #dc3545;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.delete-single-btn:hover {
  background: #dc3545;
  color: #fff;
}
</style>
