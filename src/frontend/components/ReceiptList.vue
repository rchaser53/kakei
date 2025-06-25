<template>
  <div class="receipts-section">
    <h2>レシート一覧</h2>
    <MonthSelector v-model="selectedMonth" />
    <div class="receipts-container">
      <div v-if="loading" class="loading">データを読み込み中...</div>
      <div v-else-if="receipts.length === 0" class="no-data">{{ noDataMessage }}</div>
      <div v-else>
        <div v-for="receipt in receipts" :key="receipt.id" class="receipt-card">
          <div class="receipt-header">
            <div class="receipt-date">{{ formatDate(receipt.created_at) }}</div>
            <div class="receipt-id">レシートID: {{ receipt.id }}</div>
          </div>
          <div class="receipt-details">
            <div class="receipt-store">{{ receipt.store_name }}</div>
            <div class="receipt-amount">{{ receipt.total_amount.toLocaleString() }}円</div>
          </div>
          <div class="receipt-use-image">
            <label>
              <input type="checkbox" v-model="receipt.use_image" @change="toggleUseImage(receipt)" />
              手動入力
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import MonthSelector from './MonthSelector.vue';

const receipts = ref<any[]>([]);
const loading = ref(false);
const noDataMessage = ref('');
const selectedMonth = ref('');

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
}

async function fetchReceipts() {
  if (!selectedMonth.value) {
    receipts.value = [];
    noDataMessage.value = '月を選択してください';
    return;
  }
  const [year, month] = selectedMonth.value.split('-').map(Number);
  loading.value = true;
  try {
    const res = await fetch(`/api/receipts/${year}/${month}`);
    const data = await res.json();
    receipts.value = data.receipts;
    noDataMessage.value = data.receipts.length === 0 ? 'この月のレシート情報はありません' : '';
  } catch (e) {
    receipts.value = [];
    noDataMessage.value = 'データの取得中にエラーが発生しました';
  } finally {
    loading.value = false;
  }
}

async function toggleUseImage(receipt: any) {
  const newValue = receipt.use_image;
  try {
    const response = await fetch(`/api/receipts/${receipt.image_hash}/use-image`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_image: newValue })
    });
    if (!response.ok) throw new Error('更新に失敗しました');
  } catch (e) {
    alert('use_imageの更新に失敗しました');
  }
}

onMounted(fetchReceipts);
watch(selectedMonth, fetchReceipts);
</script>

<style scoped>
.receipts-section { margin-top: 2rem; }
.receipts-container { display: flex; flex-direction: column; gap: 15px; }
.receipt-card { border: 1px solid #ddd; border-radius: 6px; padding: 15px; background: #fff; }
.receipt-header { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #eee; }
.receipt-date { font-weight: bold; color: #7f8c8d; }
.receipt-id { color: #95a5a6; font-size: 14px; }
.receipt-details { margin-bottom: 15px; }
.receipt-store { font-weight: bold; margin-bottom: 5px; }
.receipt-amount { text-align: right; font-weight: bold; color: #e74c3c; }
</style>
