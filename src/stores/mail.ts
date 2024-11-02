import { defineStore } from 'pinia'

interface Message {
  id: string
  from: {
    name: string
    address: string
  }
  to: {
    name: string
    address: string
  }[]
  subject: string
  seen: boolean
  createdAt: string
  html?: string[]
  text?: string
}

interface MailState {
  messages: Message[]
  loading: boolean
  refreshing: boolean
  account: {
    address: string
    id: string
  } | null
  domains: {
    domain: string
    id: string
  }[]
  token: string | null
  selectedMessage: Message | null
  isTokenValid: boolean
  password: string
  messageContents: Map<string, any>
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

interface StoredData {
  account: {
    address: string
    id: string
  } | null
  token: string | null
  username: string
  password: string
}

export const useMailStore = defineStore('mail', {
  state: (): MailState => ({
    messages: [],
    loading: false,
    refreshing: false,
    account: null,
    domains: [],
    token: null,
    selectedMessage: null,
    isTokenValid: false,
    password: '',
    messageContents: new Map<string, any>(),
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0
    }
  }),
  
  actions: {
    generateRandomAccount() {
      const randomString = Math.random().toString(36).substring(2, 10)
      const randomPassword = Math.random().toString(36).substring(2, 10)
      return {
        username: randomString,
        password: randomPassword
      }
    },

    async fetchDomains() {
      try {
        const response = await fetch('https://api.mail.gw/domains')
        if (!response.ok) {
          throw new Error('獲取域名失敗')
        }
        const data = await response.json()
        this.domains = data['hydra:member'].map((d: any) => ({
          domain: d.domain,
          id: d.id
        }))
        return this.domains
      } catch (error) {
        console.error('獲取域名錯誤:', error)
        throw error
      }
    },

    async createAccount(username: string, password: string, selectedDomain: string) {
      if (this.domains.length === 0) {
        await this.fetchDomains()
      }
      
      this.loading = true
      try {
        const address = `${username}@${selectedDomain}`
        const response = await fetch('https://api.mail.gw/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            address,
            password
          })
        })

        if (!response.ok) {
          throw new Error('創建帳戶失敗')
        }

        const data = await response.json()
        
        // 先獲取 token
        await this.getToken(address, password)
        
        // token 獲取成功後才設置 account
        this.account = {
          address: data.address,
          id: data.id
        }
        
        return data
      } catch (error) {
        console.error('創建帳戶錯誤:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async getToken(address: string, password: string) {
      try {
        const response = await fetch('https://api.mail.gw/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            address,
            password
          })
        })

        if (!response.ok) {
          throw new Error('獲取 token 失敗')
        }

        const data = await response.json()
        if (data.token) {
          this.token = data.token
          return data.token
        } else {
          throw new Error('回應中沒有 token')
        }
      } catch (error) {
        console.error('獲取 token 錯誤:', error)
        throw error
      }
    },

    async fetchMessages(page = 1) {
      try {
        this.refreshing = true
        const response = await fetch(`https://api.mail.gw/messages?page=${page}&itemsPerPage=${this.pagination.pageSize}`, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error('獲取郵件失敗')
        }

        const data = await response.json()
        this.messages = data['hydra:member']
        this.pagination.total = data['hydra:totalItems'] || 0
        this.pagination.page = page
        
        // 只獲取當前頁郵件的詳細內容
        for (const message of this.messages) {
          if (!this.messageContents.has(message.id)) {
            const content = await this.fetchMessageDetail(message.id)
            this.messageContents.set(message.id, content)
          }
        }

      } catch (error) {
        console.error('獲取郵件錯誤:', error)
        throw error
      } finally {
        this.refreshing = false
      }
    },

    async fetchMessageDetail(id: string) {
      try {
        const response = await fetch(`https://api.mail.gw/messages/${id}`, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error('獲取郵件詳情失敗')
        }
        
        const data = await response.json()
        return data
      } catch (error) {
        console.error('獲取郵件詳情錯誤:', error)
        throw error
      }
    },

    async checkToken() {
      if (!this.token || !this.account) return false
      
      try {
        const response = await fetch('https://api.mail.gw/me', {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        })
        this.isTokenValid = response.ok
        return response.ok
      } catch {
        this.isTokenValid = false
        return false
      }
    },

    async deleteAccount() {
      if (!this.account || !this.token) return
      
      try {
        const response = await fetch(`https://api.mail.gw/accounts/${this.account.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        })
        
        if (response.status === 204) {
          this.clearAccountData()
          return true
        }
        return false
      } catch (error) {
        console.error('刪除帳戶錯誤:', error)
        throw error
      }
    },

    saveToLocalStorage() {
      const data: StoredData = {
        account: this.account,
        token: this.token,
        username: this.account?.address.split('@')[0] || '',
        password: this.password
      }
      localStorage.setItem('mailAccount', JSON.stringify(data))
    },

    loadFromLocalStorage() {
      const data = localStorage.getItem('mailAccount')
      if (data) {
        const parsed: StoredData = JSON.parse(data)
        this.account = parsed.account
        this.token = parsed.token
        return {
          username: parsed.username,
          password: parsed.password
        }
      }
      return null
    },

    clearAccountData() {
      this.account = null
      this.token = null
      this.messages = []
      localStorage.removeItem('mailAccount')
    }
  }
})