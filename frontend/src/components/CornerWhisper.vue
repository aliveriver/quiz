<template>
  <Transition name="whisper-fade">
    <div
      v-if="visible"
      class="corner-whisper"
      @click="dismiss"
    >
      你逃不掉的
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const visible = ref(false)

function dismiss() {
  visible.value = false
  localStorage.removeItem('survey_closed_by_horror')
}

onMounted(() => {
  setTimeout(() => {
    visible.value = true
  }, 2000)
})
</script>

<style scoped>
.corner-whisper {
  position: fixed;
  bottom: 20px;
  right: 20px;
  color: rgba(180, 0, 0, 0.4);
  font-size: 0.85rem;
  font-family: 'STKaiti', 'KaiTi', serif;
  letter-spacing: 0.1em;
  cursor: pointer;
  animation: whisperBreath 3s ease-in-out infinite;
  z-index: 1000;
  user-select: none;
  transition: opacity 2s ease;
}

.corner-whisper:hover {
  color: rgba(180, 0, 0, 0.7);
}

@keyframes whisperBreath {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.7; }
}

.whisper-fade-enter-active {
  transition: opacity 3s ease;
}
.whisper-fade-leave-active {
  transition: opacity 2s ease;
}
.whisper-fade-enter-from,
.whisper-fade-leave-to {
  opacity: 0;
}
</style>
