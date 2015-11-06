var gcm = require('node-gcm');

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

var sender = new gcm.Sender('API KEY');

sender.send(test, { registrationIds: regToken }, function(err, result) {
    if (err) console.error(err);
    else     console.log(result);
});