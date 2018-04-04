const Koa = require('koa');
const koaTransaction = require('../../index.js');
const mysql = require('mysql');

const app = new Koa();
app.use(koaTransaction(mysql, {
  host     : '127.0.0.1',
  user     : 'root',
  password : 'pwd',
  database : 'db',
  connectionLimit:10
}, 'single'));

//excute sql query
app.use(async ctx => {
  let results = await ctx.execSql('select * from table')
  ctx.body = results;
});


//excute sql transaction
app.use(async ctx => {
  let tran = ctx.getTranSaction();
  try {
    await tran.beginTransaction();
    await tran.query('insert into tables set a=1');
    await tran.query('insert into tables set a=2');
    await tran.commit();
    ctx.body = "success";
  } catch(err) {  
    await tran.rollback();
    ctx.body = "error";
  }
})

app.listen(3000);