<template>
  <div class="horror-overlay" :class="{ 'fade-out': fadingOut }">
    <!-- Typewriter mode -->
    <div v-if="type === 'typewriter'" class="horror-text typewriter-text">
      {{ displayedText }}<span class="cursor">|</span>
    </div>

    <!-- Shatter mode -->
    <div v-if="type === 'shatter'" class="shatter-container">
      <div v-if="!shattering" class="horror-text shatter-text" :class="{ 'glitch': glitching }">
        {{ text }}
      </div>
      <div v-if="shattering" class="shatter-grid">
        <div
          v-for="i in shardCount"
          :key="i"
          class="shard"
          :style="getShardStyle(i)"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const props = defineProps<{
  type: 'typewriter' | 'shatter'
  text: string
}>()

const emit = defineEmits<{
  done: []
}>()

const displayedText = ref('')
const fadingOut = ref(false)
const shattering = ref(false)
const glitching = ref(false)

const cols = 8
const rows = 6
const shardCount = cols * rows

function getShardStyle(index: number) {
  const col = (index - 1) % cols
  const row = Math.floor((index - 1) / cols)
  const angle = (Math.random() - 0.5) * 720
  const tx = (Math.random() - 0.5) * 800
  const ty = (Math.random() - 0.5) * 600 + 200
  const delay = Math.random() * 0.3

  return {
    left: `${(col / cols) * 100}%`,
    top: `${(row / rows) * 100}%`,
    width: `${100 / cols}%`,
    height: `${100 / rows}%`,
    '--angle': `${angle}deg`,
    '--tx': `${tx}px`,
    '--ty': `${ty}px`,
    '--delay': `${delay}s`,
  }
}

function typewriterEffect() {
  let i = 0
  const interval = setInterval(() => {
    if (i < props.text.length) {
      displayedText.value = props.text.slice(0, i + 1)
      i++
    } else {
      clearInterval(interval)
      setTimeout(() => {
        fadingOut.value = true
        setTimeout(() => emit('done'), 800)
      }, 1500)
    }
  }, 120)
}

function shatterEffect() {
  setTimeout(() => {
    glitching.value = true
    setTimeout(() => {
      shattering.value = true
      setTimeout(() => {
        emit('done')
      }, 1500)
    }, 1000)
  }, 2000)
}

onMounted(() => {
  if (props.type === 'typewriter') {
    setTimeout(typewriterEffect, 800)
  } else {
    shatterEffect()
  }
})
</script>

<style scoped>
.horror-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.8s ease;
}

.horror-overlay.fade-out {
  opacity: 0;
}

.horror-text {
  color: #cc0000;
  font-size: 2rem;
  font-family: 'STKaiti', 'KaiTi', serif;
  letter-spacing: 0.15em;
  text-shadow: 0 0 10px rgba(200, 0, 0, 0.5);
  user-select: none;
}

.typewriter-text {
  min-height: 3rem;
}

.cursor {
  animation: blink 0.6s step-end infinite;
  color: #cc0000;
}

@keyframes blink {
  50% { opacity: 0; }
}

.shatter-text {
  animation: fadeInScare 0.15s ease-out;
}

@keyframes fadeInScare {
  0% {
    opacity: 0;
    transform: scale(1.5);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.shatter-text.glitch {
  animation: glitchShake 0.1s linear infinite;
}

@keyframes glitchShake {
  0% { transform: translate(0, 0); }
  25% { transform: translate(-3px, 2px); }
  50% { transform: translate(3px, -2px); }
  75% { transform: translate(-2px, -3px); }
  100% { transform: translate(2px, 3px); }
}

.shatter-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shatter-grid {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
}

.shard {
  position: absolute;
  background: #000;
  border: 1px solid rgba(100, 0, 0, 0.3);
  animation: shardFly 1.2s var(--delay) ease-in forwards;
}

@keyframes shardFly {
  0% {
    transform: rotate(0deg) translate(0, 0);
    opacity: 1;
  }
  100% {
    transform: rotate(var(--angle)) translate(var(--tx), var(--ty));
    opacity: 0;
  }
}
</style>
