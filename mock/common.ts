export default [
  {
    url: '/api/common/get',
    args: {
      from: 'renderer',
    },
    method: 'get',
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
          name: 'Success response from mock server',
        }
      }
    }
  },
]