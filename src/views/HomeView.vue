<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useMailStore } from '../stores/mail'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Refresh } from '@element-plus/icons-vue'

const mailStore = useMailStore()
const username = ref('')
const password = ref('')
const error = ref('')
const selectedDomain = ref('')

const refreshDisabled = ref(false)
let messageInterval: number | null = null

const startMessagePolling = () => {
  messageInterval = window.setInterval(() => {
    mailStore.fetchMessages()
  }, 8000)
}

const handleManualRefresh = async () => {
  if (refreshDisabled.value) return
  
  refreshDisabled.value = true
  await mailStore.fetchMessages()
  setTimeout(() => {
    refreshDisabled.value = false
  }, 8000)
}

const handleDeleteAccount = async () => {
  ElMessageBox.confirm(
    '確定要刪除此帳戶嗎？此操作無法復原。',
    '警告',
    {
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await mailStore.deleteAccount()
      const { username: randomUsername, password: randomPassword } = mailStore.generateRandomAccount()
      username.value = randomUsername
      password.value = randomPassword
      ElMessage.success('帳戶已刪除')
    } catch (err) {
      error.value = '刪除帳戶失敗'
      ElMessage.error('刪除帳戶失敗')
      console.error(err)
    }
  }).catch(() => {
    ElMessage.info('已取消刪除')
  })
}

onMounted(async () => {
  try {
    await mailStore.fetchDomains()
    const savedData = mailStore.loadFromLocalStorage()
    
    if (savedData) {
      username.value = savedData.username
      password.value = savedData.password
      selectedDomain.value = mailStore.account?.address.split('@')[1] || mailStore.domains[0].domain
      
      if (await mailStore.checkToken()) {
        await mailStore.fetchMessages()
        startMessagePolling()
      } else {
        mailStore.clearAccountData()
        initializeRandomAccount()
      }
    } else {
      initializeRandomAccount()
    }
  } catch (err) {
    error.value = '獲取域名失敗'
  }
})

const initializeRandomAccount = () => {
  if (mailStore.domains.length > 0) {
    selectedDomain.value = mailStore.domains[0].domain
    const { username: randomUsername, password: randomPassword } = mailStore.generateRandomAccount()
    username.value = randomUsername
    password.value = randomPassword
  }
}

onUnmounted(() => {
  if (messageInterval) {
    clearInterval(messageInterval)
  }
})

const getFullAddress = () => {
  return `${username.value}@${selectedDomain.value}`
}

const copyAddress = async () => {
  try {
    await navigator.clipboard.writeText(getFullAddress())
    showNotification('郵箱地址已複製!', 'warning')
  } catch (err) {
    showNotification('複製失敗', 'is-danger')
    console.error('複製失敗:', err)
  }
}

const handleCreateAccount = async () => {
  try {
    error.value = ''
    const accountData = await mailStore.createAccount(username.value, password.value, selectedDomain.value)
    await mailStore.getToken(accountData.address, password.value)
    mailStore.saveToLocalStorage()
    await copyAddress()
    showNotification('帳戶創建成功!')
    startMessagePolling()
  } catch (err) {
    error.value = '創建帳戶失敗,請稍後再試'
    showNotification('創建帳戶失敗', 'is-danger')
    console.error(err)
  }
}

const selectedMessageId = ref<string | null>(null)
const selectedMessageContent = ref<any>(null)

const toggleMessage = async (messageId: string) => {
  if (selectedMessageId.value === messageId) {
    selectedMessageId.value = null
    selectedMessageContent.value = null
    return
  }
  
  try {
    selectedMessageId.value = messageId
    const messageDetail = await mailStore.fetchMessageDetail(messageId)
    selectedMessageContent.value = messageDetail
  } catch (err) {
    console.error('獲取郵件詳情失敗:', err)
    selectedMessageId.value = null
  }
}

const showNotification = (message: string, type: string = 'success') => {
  ElMessage({
    message,
    type: type as 'success' | 'warning' | 'info' | 'error' ,
    duration: 3000
  })
}
</script>

<template>
  <el-container class="container">
    <el-main>
      <el-card class="form">
        <template #header>
          <h1>創建臨時郵箱帳戶</h1>
        </template>

        <el-form label-width="80px">
          <el-form-item label="郵箱:">
            <div style="display: flex; align-items: center; gap: 10px">
              <el-input
                v-model="username"
                placeholder="請輸入用戶名"
                :disabled="!!mailStore.account"
              />
              <span style="color: #606266">@</span>
              <el-select 
                v-model="selectedDomain"
                placeholder="選擇域名"
                :disabled="!!mailStore.account"
                style="width: auto; min-width: 200px"
              >
                <el-option
                  v-for="domain in mailStore.domains"
                  :key="domain.id"
                  :label="domain.domain"
                  :value="domain.domain"
                  style="white-space: nowrap"
                />
              </el-select>
              <el-button
                @click="copyAddress"
                type="primary"
                plain
                size="small"
                :icon="Document"
              >
                複製
              </el-button>
            </div>
          </el-form-item>

          <el-form-item v-if="!mailStore.account" label="密碼:">
            <el-input
              v-model="password"
              type="password"
              placeholder="請輸入密碼"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              v-if="!mailStore.account"
              type="success"
              plain
              @click="handleCreateAccount"
              :loading="mailStore.loading"
              :disabled="!selectedDomain"
            >
              {{ mailStore.loading ? '創建中...' : '創建帳戶' }}
            </el-button>
            <el-button
              v-else
              type="danger"
              plain
              @click="handleDeleteAccount"
              size="default"
            >
              刪除帳戶
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card v-if="mailStore.account" class="messages-section">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>收件匣</span>
            <el-button
              @click="handleManualRefresh"
              :loading="mailStore.refreshing"
              :disabled="refreshDisabled"
              :icon="Refresh"
              type="primary"
              plain
              size="small"
              style="max-width: 100px"
            >
              重新整理
            </el-button>
          </div>
        </template>

        <el-table :data="mailStore.messages">
          <el-table-column prop="from.address" label="寄件人" />
          <el-table-column prop="subject" label="主旨" />
          <el-table-column label="時間">
            <template #default="scope">
              {{ new Date(scope.row.createdAt).toLocaleString() }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-main>
  </el-container>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.messages-section {
  margin-top: 30px;
}
</style>
