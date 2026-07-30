export default [
  {
    url: '/api/user/login',
    method: 'post',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    response: () => {
      return {
        code: 200,
        message: 'success',
        data: {
          email: 'test@test.com',
          username: 'test',
          avatar: 'https://s.gravatar.com/avatar/a8248fe42a393dd6eac1ae0069bf8b2a?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fke.png',
          accessToken: '123456',
          refreshToken: '123456',
        }
      }
    }
  },
  {
    url: '/api/user/refresh',
    method: 'post',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    response: () => {
      return {
        code: 200,
        message: 'success',
        data: {
          accessToken: '123456',
          refreshToken: '123456',
        }
      }
    }
  },
]