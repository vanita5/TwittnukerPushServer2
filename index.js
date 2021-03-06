var express = require('express'),
    bodyParser = require('body-parser'),
    twit = require('twit'),
    lowdb = require('lowdb'),
    StreamHandler = require('./handler'),
    gcm = require('node-gcm'),
    packagejson = require('./package.json'),
    winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)(),
        new (winston.transports.File)({
            filename: 'main.log',
            level: 'silly'
        })
    ]
});

try {
    var config = require('./config');
    if (!config.gcm || !config.twitter) throw "config file corrupted";
} catch (error) {
    logger.error(error);
    logger.error(
        "Error loading config file.\n" +
        "\n" +
        "Please copy config_example.js to config.js and edit accordingly!"
    );
    process.exit(1);
}

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));

var db = lowdb(packagejson._DB_VERSION, {
    autosave: true,
    async: false
});

var twitter = {
    instances: []
};

var initTwitterInstances = function() {
    logger.log('debug', "called initTwitterInstances");
    if (config.twitter.length == 0) {
        logger.error("No Twitter configurations. Please edit config.js accordingly!");
        return;
    }
    else if (db('tokens').size() == 0) {
        logger.info("No device registered. Please setup Twittnuker to receive Push Notifications from this server!");
    }

    config.twitter.forEach(function(profile) {
        var T = new twit({
            consumer_key:         profile.consumer_key
            , consumer_secret:      profile.consumer_secret
            , access_token:         profile.access_token
            , access_token_secret:  profile.access_token_secret
        });

        var stream = null;
        var userId = null;
        T.get('account/verify_credentials', { skip_status: true }, function (err, data, response) {
            stream = new StreamHandler(T, data.id_str, logger);
            stream.start();
            userId = data.id_str;

            var instance = {
                twit: T,
                stream: stream,
                userId: userId
            };

            logger.log('debug', "Added Twitter instance", { instance: instance });
            twitter.instances.push(instance);
        });
    });
};

var updateTwitterInstances = function() {
    twitter.instances.forEach(function(instance) {
        instance.stream.stop();
    });
    twitter.instances = [];
    initTwitterInstances();
};

var sendSuccessNotification = function(regID) {
    var sender = new gcm.Sender(config.gcm.api_key);
    var message = new gcm.Message({
        restrictedPackageName: "de.vanita5.twittnuker",
        notification: {
            title: "Twittnuker",
            icon: "ic_action_twittnuker",
            body: "Success! This is a test message."
        }
    });
    sender.send(message, { registrationIds: [ regID ] }, function(err, result) {
        if (err) logger.error(err);
        //else     logger.log(result);
    });
};

/**
 *
 */
app.get('/', function(req, res) {
    res.send('This is a Twittnuker Push Server instance. Set this address to the respective setting in Twittnuker to receive push notifications.');
});

/**
 * POST register
 * Adds a token to the database if the given Twitter user id is configured
 */
app.post('/register', function(req, res) {
    var token = req.body.token;
    var twitterUserId = req.body.userId;

    logger.info('Register: ' + token + ' for Twitter User ' + twitterUserId);

    //Wait 5s -
    setTimeout(function() {
        var isConfigured = false;
        twitter.instances.forEach(function(instance) {
            if (instance.userId == twitterUserId) isConfigured = true;
        });
        if (isConfigured) {
            if (db('tokens').find({ id: twitterUserId })) {
                if (db('tokens')
                    .chain()
                    .find({ id: twitterUserId })
                    .value()
                    .tokens
                    .indexOf(token) == -1) {
                    db('tokens')
                        .chain()
                        .find({ id: twitterUserId })
                        .value()
                        .tokens
                        .push(token);
                    db.saveSync();
                }
            } else {
                db('tokens').push({id: twitterUserId, tokens: [token]});
                db.saveSync();
            }
            updateTwitterInstances();
            sendSuccessNotification(token);

            res.set('Content-Type', 'application/json');
            res.send('{ "status": "Ok" }');
        } else {
            res.set('Content-Type', 'application/json');
            res.send('{ "status": "Failed" }');
        }
    }, 5000);
});

/**
 * POST remove
 * Remove token from database
 */
app.post('/remove', function(req, res) {
    var token = req.body.token;

    logger.info('Remove: ' + token);

    var elements = db('tokens').value();
    elements.forEach(function(el) {
        var idx = el.tokens.indexOf(token);
        if (idx > -1) {
            el.tokens.splice(idx, 1);
        }
    });
    db.saveSync();

    updateTwitterInstances();

    res.set('Content-Type', 'application/json');
    res.send('{ "status": "Ok" }');
});

/**
 * Init
 */
var server = app.listen(7331, function() {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('Twittnuker Push running at http://%s:%s', host, port);
});
updateTwitterInstances();
setInterval(function() {
    //Log twitter instances
    logger.log('silly', "Twitter instances: " + twitter.instances.length);
}, 1000*60*60*3); //every 3h