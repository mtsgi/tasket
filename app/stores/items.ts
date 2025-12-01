import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { Item, ItemType } from '~/types/item'
import { getAllItems, addItem, updateItem, deleteItem } from '~/utils/db'
import { getStartOfDay, getEndOfDay, getStartOfMonth, getEndOfMonth } from '~/utils/dateHelpers'

export const useItemsStore = defineStore('items', {
  state: () => ({
    items: [] as Item[],
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    getItemsByDate: (state) => {
      return (dateString: string) => {
        const startOfDay = getStartOfDay(dateString)
        const endOfDay = getEndOfDay(dateString)
        return state.items
          .filter((item) => {
            const scheduledAt = new Date(item.scheduled_at)
            return scheduledAt >= startOfDay && scheduledAt <= endOfDay
          })
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      }
    },

    getItemsByMonth: (state) => {
      return (yearMonth: string) => {
        const startOfMonth = getStartOfMonth(yearMonth + '-01')
        const endOfMonth = getEndOfMonth(yearMonth + '-01')
        return state.items
          .filter((item) => {
            const scheduledAt = new Date(item.scheduled_at)
            return scheduledAt >= startOfMonth && scheduledAt <= endOfMonth
          })
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      }
    },
  },

  actions: {
    async fetchItems() {
      this.isLoading = true
      this.error = null
      try {
        this.items = await getAllItems()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to fetch items'
      }
      finally {
        this.isLoading = false
      }
    },

    async createItem(data: {
      title: string
      amount: number
      type: ItemType
      scheduled_at: Date
    }) {
      const newItem: Item = {
        id: uuidv4(),
        title: data.title,
        amount: data.amount,
        type: data.type,
        is_completed: false,
        scheduled_at: data.scheduled_at,
        executed_at: null,
        created_at: new Date(),
      }
      await addItem(newItem)
      this.items.push(newItem)
      return newItem
    },

    async updateItemById(id: string, data: Partial<Omit<Item, 'id' | 'created_at'>>) {
      const index = this.items.findIndex(item => item.id === id)
      if (index !== -1) {
        const updatedItem = { ...this.items[index], ...data }
        await updateItem(updatedItem)
        this.items[index] = updatedItem
        return updatedItem
      }
      return null
    },

    async toggleComplete(id: string) {
      const item = this.items.find(item => item.id === id)
      if (item) {
        const isCompleted = !item.is_completed
        const executedAt = isCompleted ? new Date() : null
        await this.updateItemById(id, {
          is_completed: isCompleted,
          executed_at: executedAt,
        })
      }
    },

    async deleteItemById(id: string) {
      await deleteItem(id)
      const index = this.items.findIndex(item => item.id === id)
      if (index !== -1) {
        this.items.splice(index, 1)
      }
    },
  },
})
