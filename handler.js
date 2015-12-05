var gcm = require('node-gcm'),
    config = require('./config'),
    lowdb = require('lowdb'),
    Entities = require('html-entities').AllHtmlEntities,
    packagejson = require('./package.json');

var StreamHandler = function(T, userId, logger) {
    this.T = T;
    this.userId = userId;
    this.logger = logger;

    this.stream = null;
};

StreamHandler.prototype.stop = function() {
    if (this.stream) this.stream.stop();
};

StreamHandler.prototype.start = function() {
    this.stream = this.T.stream('user');

    var userId = this.userId;
    var logger = this.logger;

    var db = lowdb(packagejson._DB_VERSION);
    var sender = new gcm.Sender(config.gcm.api_key);
    var htmlEntities = new Entities();

    this.stream.on('tweet', function(status) {
        if (isMyRetweet(status, userId)) {
            logger.info('Retweet from ' + status.user.screen_name);
            notify(
                userId,
                status.user.screen_name,
                'type_retweet',
                decodeText(status.retweeted_status),
                status.user.profile_image_url,
                status.retweeted_status.id_str,
                status.user.id_str
            );
        }
        else if (isMention(status, userId)) {
            logger.info('Mention from ' + status.user.screen_name);
            notify(
                userId,
                status.user.screen_name,
                'type_mention',
                decodeText(status),
                status.user.profile_image_url,
                status.id_str,
                status.user.id_str
            );
        }
    });

    this.stream.on('direct_message', function (dm) {
        if (!isDMFromMe(dm, userId)) {
            logger.info('DM from ' + dm.direct_message.sender.screen_name);
            notify(
                userId,
                dm.direct_message.sender.screen_name,
                'type_direct_message',
                decodeText(dm.direct_message),
                dm.direct_message.sender.profile_image_url,
                dm.direct_message.id_str,
                dm.direct_message.sender.id_str
            );
        }
    });

    this.stream.on('follow', function (event) {
        if (isMyEvent(event, userId)) {
            logger.info('Follow from ' + event.source.screen_name);
            notify(
                userId,
                event.source.screen_name,
                'type_new_follower',
                null,
                event.source.profile_image_url,
                null,
                event.source.id_str
            );
        }
    });

    this.stream.on('favorite', function (event) {
        if (isMyEvent(event, userId)) {
            logger.info('Like from ' + event.source.screen_name);
            notify(
                userId,
                event.source.screen_name,
                'type_favorite',
                decodeText(event.target_object),
                event.source.profile_image_url,
                event.target_object.id_str,
                event.source.id_str
            );
        }
    });

    this.stream.on('user_event', function (event) {
        switch (event.event) {
            case 'quoted_tweet':
                if (isMyEvent(event, userId)) {
                    logger.info('Quoted by ' + event.source.screen_name);
                    notify(
                        userId,
                        event.source.screen_name,
                        'type_quote',
                        decodeText(event.target_object),
                        event.source.profile_image_url,
                        event.target_object.id_str,
                        event.source.id_str
                    );
                }
                break;
            default:
                break;
        }
    });

    this.stream.on('connect', function (request) {
        logger.info("Connect to user stream...");
    });

    this.stream.on('connected', function (response) {
        logger.info("User stream connected.")
    });

    this.stream.on('reconnect', function (request, response, connectInterval) {
        logger.info("Reconnecting to user stream...")
    });

    this.stream.on('disconnect', function(message) {
        logger.error("Stream disconnected with message: " + message);
        notifyDisconnect(userId);
    });


    var decodeText = function(status) {
        var text = status.text;
        status.entities.urls.forEach(function(url) {
            text =
                text.substring(0, url.indices[0]) +
                url.display_url +
                text.substring(url.indices[1]);
        });
        return htmlEntities.decode(text.replace(/\r?\n|\r/g, ' '));
    };

    var isMyRetweet = function(status, userId) {
        return status.retweeted_status
            && status.retweeted_status.user.id_str == userId;
    };

    var isMention = function(status, userId) {
        var result = false;
        status.entities.user_mentions.forEach(function(mention) {
            if (mention.id_str == userId) result = true;
        });
        return result;
    };

    var isDMFromMe = function(dm, userId) {
        return dm.direct_message.sender.id_str == userId;
    };

    var isMyEvent = function(event, userId) {
        return event.source.id_str != userId;
    };

    var notify = function(userId, fromuser, type, msg, image_url, object_id, object_user_id) {
        var message = new gcm.Message({
            priority: "high",
            delayWhileIdle: false,
            restrictedPackageName: "de.vanita5.twittnuker",
            data: {
                account: userId,
                fromuser: fromuser,
                type: type,
                msg: msg,
                image: image_url,
                object_id: object_id,
                object_user_id: object_user_id
            }
        });

        var regIds = db('tokens')
            .chain()
            .where({ id: userId })
            .pluck('tokens')
            .value()[0];
        sender.send(message, { registrationIds: regIds }, function(err, result) {
            if (err) logger.error(err);
            //else     logger.log(result);
        });
    };

    var notifyDisconnect = function() {
        var message = new gcm.Message({
            restrictedPackageName: "de.vanita5.twittnuker",
            notification: {
                title: "Twittnuker",
                icon: "ic_action_twittnuker",
                body: "Push Backend Server halted."
            }
        });

        var regIds = db('tokens')
            .chain()
            .where({ id: userId })
            .pluck('tokens')
            .value()[0];
        sender.send(message, { registrationIds: regIds }, function(err, result) {
            if (err) logger.error(err);
            //else     logger.info(result);
        });
    };
};

module.exports = StreamHandler;