import { createRouter, createWebHashHistory } from 'vue-router'
import { MenuEnum } from '../constants'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/map' },
    {
      path: '/map',
      name: MenuEnum.MAP,
      component: () => import('../views/MapView.vue')
    },
    {
      path: '/charts',
      name: MenuEnum.CHARTS,
      component: () => import('../views/ChartsView.vue')
    },
    {
      path: '/charts/:chartId',
      name: 'chartDetail',
      component: () => import('../views/ChartDetailView.vue'),
      props: true
    },
    {
      path: '/settings',
      name: MenuEnum.SETTINGS,
      component: () => import('../views/SettingsView.vue')
    }
  ]
})

export default router
