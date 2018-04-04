koa-msyql-transaction
============
 koa-msyql-transaction is a koa mysql middleware, Inspired by [express-myconnection](https://github.com/pwalczyszyn/express-myconnection). it provides a consistent API for MySQL connections during koa request/response life cycle. It supports three different strategies of managing db connections: ` single ` for a singleton connection on an app instance level, `pool` based connections, and a new connection per each `request`. It’s also capable of auto closing/releasing connections if configured either with `pool` or `request`. It uses [node-mysql](https://github.com/felixge/node-mysql) as a MySQL driver.


### Install
```
npm install koa-msyql-transaction
```


### Strategies

*   `single` - creates single database connection for an application instance. Connection is never closed. In case of disconnection it will try to reconnect again as described in [node-mysql docs](https://github.com/felixge/node-mysql).
*   `pool` - creates pool of connections on an app instance level, and serves a single connection from pool per request. The connections is auto released to the pool at the query end.
*   `request` - creates new connection per each request, and automatically closes it at the response end.

### Usage

Configuration is straightforward and you use it as any other middleware. First param it accepts is a  [node-mysql](https://github.com/felixge/node-mysql) module, second is a db options hash passed to [node-mysql](https://github.com/felixge/node-mysql) module when connection or pool are created. The third is string defining strategy type.

    // app.js
    ...
    var mysql = require('mysql'), // node-mysql module
        koaTransaction = require('koa-mysql-transaction'), // express-myconnection module
        dbOptions = {
          host: 'localhost',
          user: 'dbuser',
          password: 'password',
          port: 3306,
          database: 'mydb',
          connectionLimit:10
        };
      
    app.use(koaTransaction(mysql, dbOptions, 'single');
    ...


    //excute sql query
    ...
    app.use(async ctx => {
      let results = await ctx.execSql('select * from lan_room')
      ctx.body = results;
    });
    ...

    //excute sql transaction
    ...
    app.use(async ctx => {
      let tran = ctx.getTranSaction();
      try {
        await tran.beginTransaction();
        await tran.query('insert into tables set a=1');
        await tran.query('insert into tables set a=2');
        await tran.rollback();
        await tran.release();
        ctx.body = "success";
      } catch(err) {  
        await tran.rollback();
        await tran.release();
        ctx.body = "error";
      }
    })
    ...