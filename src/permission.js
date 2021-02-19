import router from './router'
import store from './store'
import { Message } from 'element-ui'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css' // progress bar style
import { getToken } from '@/utils/auth' // get token from cookie
import getPageTitle from '@/utils/get-page-title'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const whiteList = ['/login'] // no redirect whitelist

router.beforeEach(async(to, from, next) => {
  // start progress bar
  NProgress.start()

  // set page title
  document.title = getPageTitle(to.meta.title)

  // determine whether the user has logged in
  const hasToken = getToken()

  if (hasToken) {
    if (to.path === '/login') {
      // if is logged in, redirect to the home page
      next({ path: '/' })
      NProgress.done()
    } else {
      // determine whether the user has obtained his permission roles through getInfo
      const hasRoles = store.getters.roles && store.getters.roles.length > 0
      if (hasRoles) {
        next()
      } else {
        try {
          // get user info
          // note: roles must be a object array! such as: ['admin'] or ,['developer','editor']
          const { roles } = await store.dispatch('user/getInfo')

          // generate accessible routes map based on roles
          /*
            该项目中权限的实现方式是：
            通过获取当前用户的权限去比对路由表，
            生成当前用户具有的权限可访问的路由表，
            通过 router.addRoutes 动态挂载到 router 上。

            但其实很多公司的业务逻辑可能不是这样的，
            举一个例子来说，很多公司的需求是每个页面的权限是动态配置的，
            不像本项目中是写死预设的。但其实原理是相同的。
            如：你可以在后台通过一个 tree 控件或者其它展现形式给每一个页面动态配置权限，
            之后将这份路由表存储到后端。当用户登录后得到 roles，前端根据roles 去向后端请求可访问的路由表，
            从而动态生成可访问页面，之后就是 router.addRoutes 动态挂载到 router 上，你会发现原理是相同的，万变不离其宗。
          */
          // https://panjiachen.gitee.io/vue-element-admin-site/zh/guide/essentials/permission.html#%E6%9D%83%E9%99%90%E9%AA%8C%E8%AF%81 代码块部分是重点
          // accessRoutes要从后端获取
          const accessRoutes = await store.dispatch('permission/generateRoutes', roles)

          // dynamically add accessible routes
          router.addRoutes(accessRoutes)

          // hack method to ensure that addRoutes is complete
          // set the replace: true, so the navigation will not leave a history record
          next({ ...to, replace: true })
        } catch (error) {
          // remove token and go to login page to re-login
          await store.dispatch('user/resetToken')
          Message.error(error || 'Has Error')
          next(`/login?redirect=${to.path}`)
          NProgress.done()
        }
      }
    }
  } else {
    /* has no token*/

    if (whiteList.indexOf(to.path) !== -1) {
      // in the free login whitelist, go directly
      next()
    } else {
      // other pages that do not have permission to access are redirected to the login page.
      next(`/login?redirect=${to.path}`)
      NProgress.done()
    }
  }
})

router.afterEach(() => {
  // finish progress bar
  NProgress.done()
})
