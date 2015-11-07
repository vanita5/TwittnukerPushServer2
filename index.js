var express = require('express'),
    gcm = require('node-gcm'),
    config = require('./config');

var app = express();

var sender = new gcm.Sender(config.gcm.api_key);


app.get('/', function(req, res) {
    res.send('This is a Twittnuker Push Server instance. Set this address to the respective setting in Twittnuker to receive push notifications.');
});

var server = app.listen(7331, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.info('Twittnuker Push running at http://%s:%s', host, port);
});


// TEST
var test = new gcm.Message({
    priority: 'normal',
    contentAvailable: true,
    delayWhileIdle: true,
    restrictedPackageName: "de.vanita5.twittnuker",
    data: {
        message: 'message1',
        key2: 'message2'
    },
    notification: {
        title: "Twittnuker",
        icon: "ic_action_retweet",
        body: "@_vanita5 liked your tweet."
    }
});

var regToken = ['REG ID'];

sender.send(test, { registrationIds: regToken }, function(err, result) {
    if (err) console.error(err);
    else     console.log(result);
});