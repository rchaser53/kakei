<template>
  <div class="container">
    <header>
      <h1>家計簿アプリ</h1>
      <nav style="margin: 1rem 0;">
        <button @click="currentView = 'register'" :class="{ active: currentView === 'register' }">商品登録</button>
        <button @click="currentView = 'list'" :class="{ active: currentView === 'list' }">レシート一覧</button>
      </nav>
    </header>
    <main>
      <RegisterProduct v-if="currentView === 'register'" />
      <ReceiptList v-else />
    </main>
    <footer>
      <p>&copy; 2025 家計簿アプリ</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import RegisterProduct from './components/RegisterProduct.vue';
import ReceiptList from './components/ReceiptList.vue';

const currentView = ref<'register' | 'list'>('register');
</script>

<style>
/* .container の重複を修正 */
.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}
header, footer {
  text-align: center;
  margin-bottom: 2rem;
}

nav button {
  margin: 0 0.5rem;
  padding: 0.5rem 1.2rem;
  border: none;
  border-radius: 4px;
  background: #eee;
  cursor: pointer;
  font-weight: bold;
}
nav button.active {
  background: #3498db;
  color: #fff;
}
</style>
