<script setup lang="ts">
import { useMailStore } from './stores/mail'

const mailStore = useMailStore()
</script>

<template>
  <div>
    <router-view></router-view>
  </div>
</template>

<style>
.notification-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.notification {
  padding: 12px 24px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  margin-bottom: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-100%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.notification.show {
  transform: translateY(0);
  opacity: 1;
}

.notification.hide {
  opacity: 0;
  transform: translateY(-100%);
}

.notification.success {
  background-color: #67c23a;
}

.notification.danger {
  background-color: #f56c6c;
}
</style>