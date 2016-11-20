/*-----------------------------------------------------------------------------
This Bot demonstrates how to use an IntentDialog with a LuisRecognizer to add 
natural language support to a bot. The example also shows how to use 
UniversalBot.send() to push notifications to a user.

For a complete walkthrough of creating this bot see the article below.

    http://docs.botframework.com/builder/node/guides/understanding-natural-language/

-----------------------------------------------------------------------------*/

var builder = require('botbuilder')
var restify = require('restify')

// Create bot and bind to console
// var connector = new builder.ConsoleConnector().listen();
// var bot = new builder.UniversalBot(connector);

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());


// Add global LUIS recognizer to bot
var model = process.env.model || 'https://api.projectoxford.ai/luis/v2.0/apps/4ba1412e-aee4-4659-a23a-0c8eb2a23a62?subscription-key=917877d63a4645e696ccdc9d99bb4984&q=';


var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
    .matches('公告咨询', [
        function (session, args, next) {
            var intent = args.intent;
            var dealObj = builder.EntityRecognizer.findEntity(intent.entities, 'dealObject');
            dealObj = dealObj ? dealObj.entity : null;
            session.userData.dealQuery = {
                dealObj: dealObj,
                company: null,
                isConnectedPerson: 'unknown'
            }
            if (!dealObj) {
                builder.Prompts.choice(session, '好的，贵公司与交易对象是否构成关联人（connected person）关系？', ['是', '不是', '不清楚']);
            }
        },
        function (session, results) {
            if (!session.userData.dealQuery.dealObj) {
                var isIndep = results.response;
                if (isIndep.entity == '是') {
                    session.userData.dealQuery.isConnectedPerson = 'true';
                    session.send('好的，下面请您提供您公司上一财年的总收入以及所在交易所。');
                    session.beginDialog('/askExchange');
                    // session.send('好的，下面请问您本次交易涉及的资产规模是多少？');
                    // session.beginDialog('/askAssets');
                } else if (isIndep.entity == '不是') {
                    session.userData.dealQuery.isConnectedPerson = 'false';
                    session.send('好的，下面请您提供您公司上一财年的总收入以及所在交易所。');
                    session.beginDialog('/askExchange');
                    // session.send('好的，下面请问您本次交易涉及的资产规模是多少？');
                    // session.beginDialog('/askAssets');
                } else {
                    session.userData.dealQuery.isConnectedPerson = 'unknown';
                    session.send('好的，您是否能够提供您公司的名称以及您交易对手的名称？');
                    session.beginDialog('/getDealObj');
                }
            }
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
        session.userData.dealQuery = {
            dealObj: null,
            company: null,
            dealAsset: null,
            companyAsset: null,
            exchange: null,
            isConnectedPerson: 'unknown'
        };
        next();
    }).cancelAction('cancelOperation', "已取消操作", {
        matches: /^(取消)/i,
        confirmPrompt: "确定？"
    });
bot.dialog('/', intents);

bot.dialog('/askAssets', new builder.IntentDialog({ recognizers: [recognizer] })
    .matches('资产', [
        function(session, args, next) {
            var money = builder.EntityRecognizer.findEntity(args.entities, 'builtin.money');
            if (money) {
                session.userData.dealQuery.dealAsset = money.entity;
                var message = '';
                session.send('好的，您提供的信息如下：');
                if (session.userData.dealQuery.company && session.userData.dealQuery.dealObj) {
                    message = message + '公司名称：' + session.userData.dealQuery.company + '\n';
                    message = message + '交易对手：' + session.userData.dealQuery.dealObj + '\n';
                }
                message = message + '是否关联：' + (session.userData.dealQuery.isConnectedPerson == 'true' ? '是' : '否') + '\n';
                message = message + '交易所：' + session.userData.dealQuery.exchange + '\n';
                message = message + '公司去年总收入：' + session.userData.dealQuery.companyAsset ;
                session.send(message);
                session.send('经过小绿的判断，根据' + session.userData.dealQuery.exchange + '交易所相关法律规定，您的此次交易需要进行披露，我们已经为您推荐相似的上市公司公告，小绿十分欢迎您的使用，期待再次为您服务，谢谢。');
                session.endConversation();
            } else {
                session.send('请提供交易资产金额');
                session.replaceDialog('/askAssets');
            }
        }
    ])
    .cancelAction('cancelOperation', "已取消操作", {
        matches: /^(取消)/i,
        confirmPrompt: "确定？"
    })
    .onDefault((session) => {
        session.send('对不起，我不能理解，请重新输入或输入"取消"');
        session.replaceDialog('/askAssets');
    })
);


bot.dialog('/getDealObj', new builder.IntentDialog({ recognizers: [recognizer] })
    .matches('交易对象', [
        function (session, args, next) {
            var intent = args.intent;
            var dealObj = builder.EntityRecognizer.findEntity(args.entities, 'dealObject');
            var company = builder.EntityRecognizer.findEntity(args.entities, 'company');
            if (dealObj && company) {
                session.userData.dealQuery.dealObj = dealObj.entity;
                session.userData.dealQuery.company = company.entity;
                session.send('我知道了，请您稍后。');
                var message = '根据我们的数据库查询，您的交易对手为' + dealObj.entity + '公司，它并不会与贵公司(' + company.entity + ')构成关联人关系';
                //builder.Prompts.choice(session, message, ['确认', '不对']);
                builder.Prompts.text(session, message);
                next({response: {entity: '确认'}});
            } else {
                if (!session.userData.dealQuery.company && !company) {
                    builder.Prompts.text(session, '请提供贵公司名称');
                }
            }
        },
        function(session, results, next) {
            if (results.response) {
                session.userData.dealQuery.company = results.response;
            }
            if (!session.userData.dealQuery.dealObj) {
                builder.Prompts.text(session, '请提供交易对象名称');
            } else {
                next();
            }
        },
        function (session, results, next) {
            if (results.response) {
                session.userData.dealQuery.dealObj = results.response;
            }
            //var isIndep = results.response;
            if (session.userData.dealQuery.dealObj && session.userData.dealQuery.company) {
                session.userData.dealQuery.companyAsset = '1000亿美元';
                session.userData.dealQuery.exchange = '香港';
                var message = '根据您提供的公司名称我们查询到贵公司为香港联交所上市公司，上一年度的总收入为1000亿美元，请您确认以上信息。';
                builder.Prompts.choice(session, message, ['确认', '不对']);
            } else {
                session.endConversation('对不起，我们不能为您继续服务');
            }
        },
        function(session, results) {
            var confirm = results.response;
            if (confirm.entity == '确认') {
                session.send('好的，下面请问您本次交易涉及的资产规模是多少？');
                session.beginDialog('/askAssets');
            }
        }
    ])
    .cancelAction('cancelOperation', "已取消操作", {
        matches: /^(取消)/i,
        confirmPrompt: "确定？"
    })
    .onDefault((session) => {
        session.send('对不起，我不能理解，请重新输入或输入"取消"');
        session.replaceDialog('/getDealObj');
    })
);

bot.dialog('/askExchange', new builder.IntentDialog({ recognizers: [recognizer] })
    .matches('交易所', [
        function (session, args, next) {
            var exchange = builder.EntityRecognizer.findEntity(args.entities, 'exchange');
            var money = builder.EntityRecognizer.findEntity(args.entities, 'builtin.money');
            if (money && exchange) {
                session.userData.dealQuery.exchange = exchange.entity;
                var companyAsset = session.userData.dealQuery.companyAsset = money.entity.replace('入', '').replace('是', '');
                var message = '小绿听懂了，上一财年贵公司的总收入为' + companyAsset + '，所在交易所为' + exchange.entity + '交易所。请您确认。';
                builder.Prompts.choice(session, message, ['确认', '不对']);
                //builder.Prompts.text(session, message);
                //next({response: {entity: '确认'}});
            } else {
                if (money) {
                    var companyAsset = session.userData.dealQuery.companyAsset = money.entity.replace('入', '').replace('是', '');
                }
                if (exchange) {
                    session.userData.dealQuery.exchange = exchange.entity;
                }
                next();
            }
        },
        function(session, results, next) {
            if (results && results.response && results.response.entity == '确认') {
                session.send('好的，下面请问您本次交易涉及的资产规模是多少？');
                session.beginDialog('/askAssets');
            } else {
                if (!session.userData.dealQuery.companyAsset) {
                    builder.Prompts.text(session, '请提供贵公司去年总收入');
                } else {
                    next();
                }
            }
        },
        function(session, results, next) {
            if (results.response) {
                session.userData.dealQuery.companyAsset = results.response;
            }
            if (!session.userData.dealQuery.exchange) {
                builder.Prompts.text(session, '请提供交易所名称');
            } else {
                next();
            }
        },
        function (session, results, next) {
            if (results.response) {
                session.userData.dealQuery.exchange = results.response;
            }
            if (session.userData.dealQuery.exchange && session.userData.dealQuery.companyAsset) {
                session.send('好的，下面请问您本次交易涉及的资产规模是多少？');
                session.beginDialog('/askAssets');
                // session.endDialog();
            } else {
                session.send('公司去年收入及交易所名称未知，请重新提供');
                session.replaceDialog('/askExchange');
            }
        }
    ])
    .cancelAction('cancelOperation', "已取消操作", {
        matches: /^(取消)/i,
        confirmPrompt: "确定？"
    })
    .onDefault((session) => {
        session.send('对不起，我不能理解，请重新输入或输入"取消"');
        session.replaceDialog('/askExchange');
    })
);

