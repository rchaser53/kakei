<template>
  <!-- 認証状態に応じてログイン画面かメインアプリを表示 -->
  <Login v-if="!isAuthenticated" @login-success="handleLoginSuccess" />
  
  <!-- メインアプリ（認証済みの場合のみ表示） -->
  <div v-else class="container">
    <header>
      <h1>家計簿アプリ</h1>
      <div class="header-controls">
        <nav style="margin: 1rem 0;">
          <button @click="currentView = 'register'" :class="{ active: currentView === 'register' }">商品登録</button>
          <button @click="currentView = 'list'" :class="{ active: currentView === 'list' }">レシート一覧</button>
          <button @click="currentView = 'backup'" :class="{ active: currentView === 'backup' }">バックアップ</button>
        </nav>
        <div class="auth-controls">
          <span class="welcome-text">ようこそ！</span>
          <button @click="logout" class="logout-btn">ログアウト</button>
        </div>
      </div>
    </header>
    <main>
      <RegisterProduct v-if="currentView === 'register'" />
      <ReceiptList v-else-if="currentView === 'list'" />
      <GoogleDriveUpload v-else-if="currentView === 'backup'" />
    </main>
    <footer>
      <p>&copy; 2025 家計簿アプリ</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Login from './components/Login.vue';
import RegisterProduct from './components/RegisterProduct.vue';
import ReceiptList from './components/ReceiptList.vue';
import GoogleDriveUpload from './components/GoogleDriveUpload.vue';

const currentView = ref<'register' | 'list' | 'backup'>('list');
const isAuthenticated = ref(false);
const isLoading = ref(true);

// 認証状態チェック
const checkAuthStatus = async () => {
  try {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    isAuthenticated.value = data.authenticated;
  } catch (error) {
    console.error('認証状態チェックエラー:', error);
    isAuthenticated.value = false;
  } finally {
    isLoading.value = false;
  }
};

// ログイン成功時の処理
const handleLoginSuccess = () => {
  isAuthenticated.value = true;
};

// ログアウト機能
const logout = async () => {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      // ログアウト成功後、認証状態を更新
      isAuthenticated.value = false;
    } else {
      console.error('ログアウトに失敗しました');
    }
  } catch (error) {
    console.error('ログアウトエラー:', error);
  }
}

onMounted(() => {
  checkAuthStatus();
});
</script>

<style>
/* .container の重複を修正 */
.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

footer {
  text-align: center;
  margin-bottom: 2rem;
}

.header-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.auth-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.welcome-text {
  color: #666;
  font-size: 0.9rem;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s ease;
}

.logout-btn:hover {
  background: #c82333;
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

@media (max-width: 768px) {
  .header-controls {
    flex-direction: column;
    text-align: center;
  }
  
  .auth-controls {
    justify-content: center;
  }
}
</style>
