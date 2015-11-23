# TwittnukerPushServer2
Twittnuker Push Notification server (self-hosted)

## Installation

* Create an application on apps.twitter.com
  * Permissions: Read, Write and Access direct messages
  * Generate Token
* Copy config_example.js to config.js
* Edit config.js -> Fill in the API keys of your Twitter application
* `npm install`
* `node index.js`

Now you can enable Push Notifications in Twittnuker, enter the URL to your push server instance and go back to the main screen.
Twittnuker will now register your device on your push server instance.

That's it.
