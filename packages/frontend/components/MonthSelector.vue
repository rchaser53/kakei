<template>
  <div class="month-selector">
    <select v-model="selected" @change="emitChange">
      <option value="">月を選択してください</option>
      <option v-for="month in availableMonths" :key="month.value" :value="month.value">
        {{ month.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits(['update:modelValue']);
const selected = ref(props.modelValue);
const availableMonths = ref<{ value: string; label: string }[]>([]);

watch(() => props.modelValue, v => { selected.value = v; });

const fetchAvailableMonths = async () => {
  try {
    const res = await fetch('/api/available-months');
    
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    
    const data = await res.json();
    availableMonths.value = data.map((item: any) => ({
      value: `${item.year}-${item.month}`,
      label: `${item.year}年${item.month}月`
    }));

    // propsでmodelValueが設定されていない場合、最新の月をデフォルトとして設定
    if (!props.modelValue && availableMonths.value.length > 0) {
      const latestMonth = availableMonths.value[0].value;
      selected.value = latestMonth;
      emit('update:modelValue', latestMonth);
    }
  } catch (error) {
    console.error('月データの取得に失敗しました:', error);
  }
};

const emitChange = () => {
  emit('update:modelValue', selected.value);
};

onMounted(fetchAvailableMonths);
</script>

<style scoped>
.month-selector {
  min-width: 200px;
  margin-bottom: 1rem;
}
select {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
}
</style>
