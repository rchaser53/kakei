<template>
  <div class="register-product">
    <h2>商品登録</h2>
    <form @submit.prevent="registerProduct">
      <div>
        <label>店舗名</label>
        <input v-model="storeName" required />
      </div>
      <div>
        <label>合計金額</label>
        <input v-model.number="totalAmount" type="number" min="1" required />
      </div>
      <div>
        <label>レシート日付</label>
        <input v-model="receiptDate" type="date" required />
      </div>
      <button type="submit" :disabled="loading">登録</button>
      <span v-if="successMessage" class="success">{{ successMessage }}</span>
      <span v-if="errorMessage" class="error">{{ errorMessage }}</span>
    </form>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const storeName = ref('');
const totalAmount = ref<number|null>(null);
const receiptDate = ref('');
const loading = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

async function registerProduct() {
  loading.value = true;
  successMessage.value = '';
  errorMessage.value = '';
  try {
    const res = await fetch('/api/receipts/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_name: storeName.value,
        total_amount: totalAmount.value,
        receipt_date: receiptDate.value,
        use_image: true
      })
    });
    
    if (res.status === 401) {
      // 認証エラーの場合は親コンポーネントに通知するか、ページ全体をリロード
      window.location.reload();
      return;
    }
    
    if (!res.ok) throw new Error('登録に失敗しました');
    
    successMessage.value = '登録しました';
    storeName.value = '';
    totalAmount.value = null;
    receiptDate.value = '';
  } catch (e) {
    errorMessage.value = '登録に失敗しました';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.register-product {
  margin-bottom: 2rem;
}
form > div {
  margin-bottom: 1rem;
}
.success { color: green; margin-left: 1rem; }
.error { color: red; margin-left: 1rem; }
</style>
