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

async function fetchAvailableMonths() {
  const res = await fetch('/api/available-months');
  const data = await res.json();
  availableMonths.value = data.map((item: any) => ({
    value: `${item.year}-${item.month}`,
    label: `${item.year}年${item.month}月`
  }));
}

function emitChange() {
  emit('update:modelValue', selected.value);
}

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
