import moment from 'moment'
import sanitizeHtml from 'sanitize-html'
import anchorme from 'anchorme'

import { mapElementsById, formatDate } from '../../utils'

import tasksApi from '../../api/tasks'

const state = {
  byIds: {},
}

const getters = {
  findById (state, getters) {
    return id => {
      const task = state.byIds[id]
      const isAbandoned = !!task.abandonedAt
      const isBacklogged = !isAbandoned && !task.dueAt
      const isFinished = !!task.finishedAt
      const dueAtDate = !isBacklogged && moment.unix(task.dueAt)
      const isPending = !isBacklogged && !isFinished && !isAbandoned && dueAtDate.isBefore(moment().startOf('day'))
      const createdSinceWeeks = moment.utc().diff(moment.unix(task.createdAt), 'weeks')

      const allowedTags = ['b', 'i', 'em', 'strong']
      const anchorOptions = {
        files: false,
        attributes: [
          { name: 'target', value: '_blank' },
          { name: 'rel', value: 'noreferrer' },
        ]
      }

      return {
        ...task,
        isBacklogged,
        isFinished,
        isAbandoned,
        isPending,
        createdSinceWeeks,
        dueAtLabel: formatDate(task.dueAt),
        formattedLabel: anchorme(sanitizeHtml(task.label, { allowedTags }), anchorOptions),
      }
    }
  },

  list (state, getters) {
    return Object.keys(state.byIds)
                 .map(getters.findById)
                 .filter((task) => !task.isAbandoned)
                 .sort((t1, t2) => t1.order - t2.order)
  },

  listForToday (state, getters) {
    return getters
      .list
      .filter((task) => {
        const now = moment()
        const dueAtDate = moment.unix(task.dueAt)
        const isToday = dueAtDate.isBetween(now.startOf('day'), now.endOf('day'), 'day', '[]')
        return isToday
      })
  },

  listPending (state, getters) {
    return getters
      .list
      .filter((task) => task.isPending)
  },

  listBacklog (state, getters) {
    return getters
      .list
      .filter((task) => task.isBacklogged)
  },

  listFinished (state, getters) {
    return getters.list.filter((task) => task.isFinished)
  },

  countFinishedByDays (state, getters) {
    const byDays = {}
    getters.listFinished.forEach((task) => {
      const finishedAt = moment.unix(task.finishedAt)
      const key = finishedAt.format('YYYY-MM-DD')
      byDays[key] = (byDays[key] || 0) + 1
    })
    return byDays
  },

  countCreatedByDays (state, getters) {
    const byDays = {}
    getters.list.forEach((task) => {
      const createdAt = moment.unix(task.createdAt)
      const key = createdAt.format('YYYY-MM-DD')
      byDays[key] = (byDays[key] || 0) + 1
    })
    return byDays
  },
}

const actions = {
  list ({ commit }) {
    return tasksApi.list()
                   .then((data) => commit('addList', data))
  },

  create ({ commit }, { label, dueAt }) {
    return tasksApi
      .create(label, dueAt)
      .then((data) => {
        commit('addList', [data])
        return data.id
      })
  },

  update ({ commit }, { task, label }) {
    return tasksApi.update(task, label)
                   .then((data) => commit('set', data))
  },

  finish ({ commit }, { task }) {
    return tasksApi.finish(task)
                   .then((data) => commit('set', data))
  },

  restart ({ commit }, { task }) {
    return tasksApi.restart(task)
                   .then((data) => commit('set', data))
  },

  start ({ commit }, { task }) {
    return tasksApi.start(task)
                   .then((data) => commit('set', data))
  },

  abandon ({ commit }, { task }) {
    return tasksApi.abandon(task)
                   .then((data) => commit('set', data))
  },

  orderAfter ({ commit }, { task, afterTaskId }) {
    return tasksApi.orderAfter(task, afterTaskId)
                   .then((data) => commit('setOrder', data))
  },
}

const mutations = {
  addList (state, tasks) {
    state.byIds = {
      ...state.byIds,
      ...mapElementsById(tasks),
    }
  },

  set (state, task) {
    state.byIds = {
      ...state.byIds,
      [task.id]: task,
    }
  },

  setOrder (state, newOrderTasks) {
    const impactedTasks = newOrderTasks.map(orderTask => {
      return {
        ...state.byIds[orderTask.id],
        order: orderTask.order,
      }
    }).filter(task => task.id != null)
    state.byIds = {
      ...state.byIds,
      ...mapElementsById(impactedTasks),
    }
  },

  reset (state) {
    state.current = null
    state.byIds = {}
  },
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
}
