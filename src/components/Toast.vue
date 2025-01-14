<template>
  <transition name="toast">
    <div v-if="show" class="toast" :class="type">
      {{ message }}
    </div>
  </transition>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    message: String,
    type: {
      type: String,
      default: 'info'
    },
    duration: {
      type: Number,
      default: 3000
    }
  },
  
  setup(props, { emit }) {
    const show = ref(false)
    
    const showToast = () => {
      show.value = true
      setTimeout(() => {
        show.value = false
      }, props.duration)
    }
    
    return {
      show,
      showToast
    }
  }
}
</script>

<style scoped>
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  z-index: 9999;
  transition: all 0.3s;
}

.error {
  background-color: #ff4444;
}

.success {
  background-color: #00C851;
}

.info {
  background-color: #33b5e5;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style> 