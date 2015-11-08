var gcm = require('node-gcm'),
    config = require('./config'),
    lowdb = require('lowdb'),
    Entities = require('html-entities').AllHtmlEntities;

module.exports = {
    streamHandler: function(stream, userId) {

        var db = lowdb('db.json');
        var sender = new gcm.Sender(config.gcm.api_key);
        var entities = new Entities();

        stream.on('tweet', function(status) {
            if (isMyRetweet(status, userId)) {
                console.info('Retweet from ' + status.user.screen_name);
                notify(
                    userId,
                    status.user.screen_name,
                    'type_retweet',
                    entities.decode(status.retweeted_status.text),
                    status.user.profile_image_url
                );
            }
            else if (isMention(status, userId)) {
                console.info('Mention from ' + status.user.screen_name);
                notify(
                    userId,
                    status.user.screen_name,
                    'type_mention',
                    entities.decode(status.text),
                    status.user.profile_image_url
                );
            }
        });

        stream.on('direct_message', function (dm) {
            console.info('DM from ' + dm.direct_message.sender.screen_name);
            notify(
                userId,
                dm.direct_message.sender.screen_name,
                'type_direct_message',
                entities.decode(dm.direct_message.text),
                dm.direct_message.sender.profile_image_url
            );
        });

        stream.on('follow', function (event) {
            if (isMyEvent(event, userId)) {
                console.log('Follow from ' + event.source.screen_name);
                notify(
                    userId,
                    event.source.screen_name,
                    'type_new_follower',
                    null,
                    event.source.profile_image_url
                );
            }
        });

        stream.on('favorite', function (event) {
            if (isMyEvent(event, userId)) {
                console.log('Like from ' + event.source.screen_name);
                notify(
                    userId,
                    event.source.screen_name,
                    'type_favorite',
                    entities.decode(event.target_object.text),
                    event.source.profile_image_url
                );
            }
        });

        stream.on('connect', function (request) {
            console.info("Connecting to connect to user stream...");
        });

        stream.on('connected', function (response) {
            console.info("User stream connected.")
        });

        stream.on('reconnect', function (request, response, connectInterval) {
            console.info("Reconnecting to user stream...")
        });

        stream.on('disconnect', function(message) {
            console.error("Stream disconnected with message: " + message);
            notifyDisconnect();
        });


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

        var isMyEvent = function(event, userId) {
            return event.source.id_str != userId;
        };

        var notify = function(userId, fromuser, type, msg, image_url) {
            var message = new gcm.Message({
                priority: "high",
                delayWhileIdle: false,
                restrictedPackageName: "de.vanita5.twittnuker",
                data: {
                    account: userId,
                    fromuser: fromuser,
                    type: type,
                    msg: msg,
                    image: image_url
                }
            });

            var regIds = db('tokens').pluck('token');
            sender.send(message, { registrationIds: regIds }, function(err, result) {
                if (err) console.error(err);
                else     console.log(result);
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

            var regIds = db('tokens').pluck('token');
            sender.send(message, { registrationIds: regIds }, function(err, result) {
                if (err) console.error(err);
                else     console.log(result);


            });
        };
    }
};