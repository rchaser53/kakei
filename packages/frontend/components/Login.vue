<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>🏠 家計簿アプリ</h1>
        <p>ログインしてご利用ください</p>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <!-- ログインフォーム -->
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">ユーザー名</label>
          <input 
            type="text" 
            id="username" 
            v-model="loginForm.username" 
            required
            :disabled="loading"
          >
        </div>

        <div class="form-group">
          <label for="password">パスワード</label>
          <input 
            type="password" 
            id="password" 
            v-model="loginForm.password" 
            required
            :disabled="loading"
          >
        </div>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? 'ログイン中...' : 'ログイン' }}
        </button>
      </form>

      <div class="loading" v-if="loading">
        <div class="spinner"></div>
        <p>ログイン中...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const emit = defineEmits<{
  loginSuccess: []
}>();

const loading = ref(false);
const errorMessage = ref('');

const loginForm = ref({
  username: '',
  password: ''
});

// ログイン処理
const handleLogin = async () => {
  loading.value = true;
  errorMessage.value = '';
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginForm.value),
    });

    const data = await response.json();

    if (response.ok) {
      // ログイン成功 - 親コンポーネントに通知
      emit('loginSuccess');
    } else {
      errorMessage.value = data.error || 'ログインに失敗しました';
    }
  } catch (error) {
    errorMessage.value = 'ネットワークエラーが発生しました';
  } finally {
    loading.value = false;
  }
}

// ページ読み込み時に認証状態をチェック
onMounted(async () => {
  try {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    
    if (data.authenticated) {
      // 既にログイン済みの場合は親コンポーネントに通知
      emit('loginSuccess');
    }
  } catch (error) {
    console.log('認証状態チェックエラー:', error);
  }
});
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.login-container {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  color: #333;
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.login-header p {
  color: #666;
  font-size: 1rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #333;
  font-weight: 500;
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 5px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

input[type="text"]:focus,
input[type="password"]:focus {
  outline: none;
  border-color: #667eea;
}

input[type="text"]:disabled,
input[type="password"]:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.login-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.login-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 0.75rem;
  border-radius: 5px;
  margin-bottom: 1rem;
  text-align: center;
}

.loading {
  text-align: center;
  margin-top: 1rem;
}

.spinner {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
