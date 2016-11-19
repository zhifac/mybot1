/*-----------------------------------------------------------------------------
This Bot demonstrates how to use an IntentDialog with a LuisRecognizer to add 
natural language support to a bot. The example also shows how to use 
UniversalBot.send() to push notifications to a user.

For a complete walkthrough of creating this bot see the article below.

    http://docs.botframework.com/builder/node/guides/understanding-natural-language/

-----------------------------------------------------------------------------*/

//var builder = require('../core');
var builder = require('botbuilder')
var restify = require('restify')

// Create bot and bind to console
var connector = new builder.ConsoleConnector().listen();
var bot = new builder.UniversalBot(connector);

// var server = restify.createServer();
// server.listen(process.env.port || process.env.PORT || 3978, function () {
//    console.log('%s listening to %s', server.name, server.url); 
// });
// var connector = new builder.ChatConnector({
//     appId: '6540a2ac-14d6-4c04-b9f9-db50060b8272',
//     appPassword: 'ohpS5yUcm6ghhqdswEbcbGV'
// });
// var bot = new builder.UniversalBot(connector);
// server.post('/api/messages', connector.listen());


// Add global LUIS recognizer to bot
var model = process.env.model || 'https://api.projectoxford.ai/luis/v2.0/apps/e483e361-a85b-44a9-8fc5-d53e596302a0?subscription-key=917877d63a4645e696ccdc9d99bb4984&q=';


var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
    .matches('公告咨询', [
        function (session, args, next) {
            var intent = args.intent;
            var dealObj = builder.EntityRecognizer.findEntity(intent.entities, 'dealObject');
            dealObj = dealObj ? dealObj.entity : null;
            session.dialogData.dealQuery = {
                dealObj: dealObj,
                isConnectedPerson: 'unknown'
            }
            if (!dealObj) {
                session.send('好的，您能否首先介绍一下此项交易的交易对象的情况？');
            }
        }
    ])
    .matches('交易对象', [
        function (session, args, next) {
            var intent = args.intent;
            var dealObj = builder.EntityRecognizer.findEntity(intent.entities, 'dealObject');
            var company = builder.EntityRecognizer.findEntity(intent.entities, 'company');
            if (!dealObj || !company) {
                builder.prompts.choice(session, '好的，能否具体一点，比如该公司与您公司是否为关联人(connected person)？', ['是','否']);
            } else {
                session.dialogData.dealQuery.dealObj = dealObj;
                session.dialogData.dealQuery.company = company;
                session.send('我知道了，请您稍后。');
                var message = '根据我们的数据库查询，您的交易对手为' + dealObj + '公司，它并不会与贵公司构成关联人关系。请您确认。';
                builder.prompts.choice(session, message, ['确认', '不对']);
            }
        },
        function (session, results) {
            if (!session.dialogData.dealQuery.dealObj) {
                var isIndep = results.response;
                if (isIndep.entity == '是') {
                    session.dialogData.dealQuery.isConnectedPerson = 'true';
                } else if (isIndep.entity == '否') {
                    session.dialogData.dealQuery.isConnectedPerson = 'false';
                } else {
                    session.dialogData.dealQuery.isConnectedPerson = 'unknown';
                    session.send('好的，您是否能够提供您公司的名称以及您交易对手的名称？');
                }
            } else {
                var isIndep = results.response;
                if (isIndep.entity == '确认') {
                    //TODO
                    var marketValue = '';
                    var revenue = '';
                    var profit = '';
                    session.send('根据您提供的公司名称我们查询到贵公司为香港联交所上市公司，上一年度的总市值为xxx，总收入为xxx，净利润为xxx，请您确认以上信息。')
                    session.beginDialog('/askAssets');
                } else {
                    //TODO
                }
            }
        }
    ])
    .matches('金额', [
        function(session, args, next) {
            var intent = args.intent;
            var money = builder.EntityRecognizer.findEntity(intent.entities, 'builtin.money');
            if (money && session.dialogData.dealAsset == 'toBeQuery') {
                session.dialogData.dealQuery.money = money;
                builder.Prompts.choice(session, '我知道了，下面请问您此次交易是否还有其他有可能构成关联人的买家？', ['有', '没有'])
            }
        },
        function(session, results) {
            if (results.response.entity == '没有') {
                session.send('好的，请您稍后。');
                //TODO search for result
                session.send('经过小绿的判断，根据香港联交所相关法律规定，您的此次交易需要进行披露，我们已经为您推荐相似的上市公司公告，小绿十分欢迎您的使用，期待再次为您服务，谢谢。');
            } else {
                //TODO
            }
            session.endDialog();
        }
    ])
    .onDefault((session) => {
        if (session.userData.started) {
            session.send('对不起, 您的请求 "%s" 不在服务范围内.', session.message.text);
        } else {
            session.send('您好，我是您的法律助手小绿，请问有什么可以帮助您的么？');
            session.userData.started = true;
        }
    }).onBegin((session, args, next) => {
        next();
    });
bot.dialog('/', intents);

bot.dialog('/askAssets', [
    function(session, args, next) {
        session.send('好的，下面请问您本次交易涉及的资产规模是多少？')
        session.dialogData.dealAsset = 'toBeQuery';
        session.endDialog();
    }
]);




