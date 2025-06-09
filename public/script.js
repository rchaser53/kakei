// Vue.js v3アプリケーション
const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
  // データプロパティ
  setup() {
    // リアクティブな状態
    const selectedMonth = ref('');
    const availableMonths = ref([]);
    const receipts = ref([]);
    const totalAmount = ref(0);
    const loading = ref(false);
    const noDataMessage = ref('月を選択してレシート情報を表示します');

    // 計算プロパティ
    const currentMonthTitle = computed(() => {
      if (!selectedMonth.value) {
        return '月次レポート';
      }
      const [year, month] = selectedMonth.value.split('-').map(Number);
      return `${year}年${getMonthName(month)}のレポート`;
    });

    const receiptCount = computed(() => {
      // レシートをハッシュでグループ化して数える
      if (receipts.value.length === 0) return 0;
      
      const receiptsByHash = {};
      receipts.value.forEach(receipt => {
        if (!receiptsByHash[receipt.image_hash]) {
          receiptsByHash[receipt.image_hash] = [];
        }
        receiptsByHash[receipt.image_hash].push(receipt);
      });
      
      return Object.keys(receiptsByHash).length;
    });

    // メソッド
    // 月の名前を取得する関数
    function getMonthName(month) {
      const monthNames = [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月'
      ];
      return monthNames[month - 1];
    }

    // 日付をフォーマットする関数
    function formatDate(dateString) {
      const date = new Date(dateString);
      return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    }

    // 利用可能な年月のリストを取得する関数
    async function fetchAvailableMonths() {
      try {
        loading.value = true;
        const response = await fetch('/api/available-months');
        if (!response.ok) {
          throw new Error('サーバーからデータを取得できませんでした');
        }
        const data = await response.json();
        
        // 選択肢のフォーマットに変換
        availableMonths.value = data.map(item => ({
          value: `${item.year}-${item.month}`,
          label: `${item.year}年${getMonthName(item.month)}`
        }));
        
        // 最新の月を自動選択（データがある場合）
        if (availableMonths.value.length > 0) {
          selectedMonth.value = availableMonths.value[0].value;
        }
      } catch (error) {
        console.error('エラー:', error);
        availableMonths.value = [];
      } finally {
        loading.value = false;
      }
    }

    // 月ごとのレシート情報を取得する関数
    async function fetchMonthlyReceipts() {
      if (!selectedMonth.value) {
        receipts.value = [];
        totalAmount.value = 0;
        noDataMessage.value = '月を選択してレシート情報を表示します';
        return;
      }
      
      const [year, month] = selectedMonth.value.split('-').map(Number);
      
      try {
        loading.value = true;
        const response = await fetch(`/api/receipts/${year}/${month}`);
        if (!response.ok) {
          throw new Error('サーバーからデータを取得できませんでした');
        }
        const data = await response.json();
        
        // レシートデータを更新
        receipts.value = data.receipts;
        totalAmount.value = data.total;
        
        if (data.receipts.length === 0) {
          noDataMessage.value = 'この月のレシート情報はありません';
        }
      } catch (error) {
        console.error('エラー:', error);
        receipts.value = [];
        totalAmount.value = 0;
        noDataMessage.value = 'データの取得中にエラーが発生しました';
      } finally {
        loading.value = false;
      }
    }

    // 選択した月が変更されたときにデータを取得
    watch(selectedMonth, fetchMonthlyReceipts);

    // コンポーネントがマウントされたときに初期化
    onMounted(fetchAvailableMonths);

    // use_image更新API呼び出し
    async function toggleUseImage(receipt) {
      const newValue = receipt.use_image;
      try {
        const response = await fetch(`/api/receipts/${receipt.image_hash}/use-image`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ use_image: newValue })
        });
        if (!response.ok) throw new Error('更新に失敗しました');
        // receipt.use_image = newValue; // v-modelで自動反映されるため不要
      } catch (e) {
        alert('use_imageの更新に失敗しました');
      }
    }

    // テンプレートで使用する値とメソッドを返す
    return {
      selectedMonth,
      availableMonths,
      receipts,
      totalAmount,
      loading,
      noDataMessage,
      currentMonthTitle,
      receiptCount,
      formatDate,
      toggleUseImage
    };
  }
}).mount('#app');
