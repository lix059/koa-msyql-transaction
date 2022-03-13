let _mysql,
    _dbConfig,
    _connection, // This is used as a singleton in a single connection strategy
    _pool; // Pool singleton

/**
 * Handling connection disconnects, as defined here: https://github.com/felixge/node-mysql
 */
function handleDisconnect() {
    _connection = _mysql.createConnection(_dbConfig);

    _connection.connect(function (err) {
        if (err) {
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000);
        }
    });

    _connection.on('error', function (err) {
        console.log('db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

/**
 * Returns middleware that will handle mysql db connections
 *
 * @param {Object} mysql - mysql module
 * @param {Object} dbConfig - object with mysql db options
 * @param {String} or undefined strategy - default is single strategy
 * @return {Function}
 * @api public
 */
module.exports = (mysql, dbConfig, strategy) => {

  if (null == mysql) throw new Error('Missing mysql module param!');
  if (null == dbConfig) throw new Error('Missing dbConfig module param!');
  if (null == strategy) strategy = 'single';

  // Setting _mysql module ref
  _mysql = mysql;

  // Setting _dbConfig ref
  _dbConfig = dbConfig;

  // Configuring strategies
  switch (strategy) {
      case 'single':
          // Creating single connection instance
          handleDisconnect(dbConfig);
          break;
      case 'pool':
          // Creating pool instance
          _pool = _mysql.createPool(dbConfig);
          break;
      case 'request':
          // Nothing at this point do be done
          break;
      default:
          throw new Error('Not supported connection strategy!');
  }

  return async (ctx, next) =>  {
    let _requestConnection;
    switch (strategy) {
      case 'single':
          ctx.execSql = querySingle;
          ctx.getTranSaction = getTranSaction;
          await next();
          break;

      case 'pool':
          ctx.execSql = queryPool;
          ctx.getTranSaction = getTranSaction;
          await next();
          break;

      case 'request':
          // getConnection creates new connection per request
          _requestConnection = _mysql.createConnection(_dbConfig);
          ctx.execSql = queryRequest(_requestConnection);
          ctx.getTranSaction = getTranSactionRequest(_requestConnection) 
          await next();
          _requestConnection.end();
          break;
    }
  }

  function querySingle(sql, values) {
    return new Promise((resolve, reject) => {
      _connection.query(sql, values, (err,rows) => {
        if (err) {
          return reject(err)
        } else {
          return resolve(rows);
        }
      })
    })
  }

  function queryRequest(requestConnection) {
    return (sql, values) => {
      return new Promise((resolve, reject) => {
        requestConnection.query(sql, values, (err,rows) => {
          if (err) {
            return reject(err)
          } else {
            return resolve(rows);
          }
        })
      })
    };
  }

  function queryPool(sql, values) {
    return new Promise((resolve, reject) => {
      _pool.getConnection((err, connection) => {
        if (err) {
          return reject(err);
        } else {
          connection.query(sql, values, (err,rows) => {
            connection.release();
            if (err) {
              return reject(err)
            } else {
              return resolve(rows);
            }
          })
        }
      })
    })
  }


  function getTranSaction() {
    let connection = null;
    return {
      beginTransaction,
      query,
      commit,
      rollback,
      release
    };
   
    function beginTransaction() {
      return new Promise((resolve, reject) => {
        switch (strategy) {
          case 'single':
            connection = _connection;
            connection.beginTransaction((err) => {
              if(err) {
                reject(err);
              } else {
                resolve();
              }
            });
            break;
          case 'pool':
            // Creating pool instance
            _pool.getConnection((err, conn) => {
              if(err) {
                return reject(err);
              } else {
                connection = conn;
                connection.beginTransaction((err) => {
                  if(err) {
                    reject(err);
                  } else {
                    resolve();
                  }
                });
              }
            });
            break;
          default:
            reject('Not supported connection strategy!');
        }
        

      })
    }

    function query(sql, values) {
      return new Promise((resolve, reject) => {
        if(connection) {
          connection.query(sql, values, (err,rows) => {
            if (err) {
              return reject(err)
            } else {
              return resolve(rows);
            }
          })
        } else {
          reject();
        }
      })
    }

    function commit() {
      return new Promise((resolve, reject) => {
        if(connection) {
          connection.commit(err => {
            if (err) {
              return reject(err)
            } else {
              return resolve();
            }
          })
        } else {
          reject();
        }
      })
    }

    function rollback() {
      return new Promise((resolve, reject) => {
        if(connection) {
          connection.rollback(err => {
            if (err) {
              return reject(err)
            } else {
              return resolve();
            }
          })
        } else {
          reject();
        }
      })
    }

    function release() {
      switch (strategy) {
        case 'single':
          break;
        case 'pool':
          if(connection){
            connection.release();
            connection = null;
          }
          break;
        default:
            reject('Not supported connection strategy!');
      }
    }

  }

  function getTranSactionRequest(connection) {
    return () =>  {
      return {
        beginTransaction,
        query,
        commit,
        rollback,
        release
      };
     
      function beginTransaction() {
        return new Promise((resolve, reject) => {
          connection.beginTransaction((err) => {
            if(err) {
              reject(err);
            } else {
              resolve();
            }
          });
        })
      }

      function query(sql, values) {
        return new Promise((resolve, reject) => {
          if(connection) {
            connection.query(sql, values, (err,rows) => {
              if (err) {
                return reject(err)
              } else {
                return resolve(rows);
              }
            })
          } else {
            reject();
          }
        })
      }

      function commit() {
        return new Promise((resolve, reject) => {
          if(connection) {
            connection.commit(err => {
              if (err) {
                return reject(err)
              } else {
                return resolve();
              }
            })
          } else {
            reject();
          }
        })
      }

      function rollback() {
        return new Promise((resolve, reject) => {
          if(connection) {
            connection.rollback(err => {
              if (err) {
                return reject(err)
              } else {
                return resolve();
              }
            })
          } else {
            reject();
          }
        })
      }

      function release() {}
    }
  }

}



