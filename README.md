# Password Manager 2.0


### Installing

Clone the repo by using `git clone https://github.com/IceBotYT/password-manager`.  
Install dependencies by running `npm i`.  
Make a `.env` file and put the following in it:

```
SESSION_SECRET=INSERT_SESSION_SECRET
CRYPTO_KEY=INSERT_CRYPTO_SECRET
PORT=INSERT_PORT
IFTTT=INSERT_IFTTT_KEY
```

You can change these properties to whatever you want.  
Make sure none of them have quotes.

### Launching

Launch by using `npm start`.  
It will be hosted on the port you chose.

For example:  
If you chose `3000` as your port, then it will be hosted on `(IP_ADDRESS):(PORT)`.

### Updates

Any new updates can be installed by `git pull`.

### IFTTT Setup

If you want to use IFTTT for push notifications to your device, you may do that.  
If you do not want to use it, change the variable at the top of `server.js`.

1. Create an IFTTT account.  
If you haven't already, [create an IFTTT account](https://ifttt.com/join).

2. Make a new applet.  
Since IFTTT turned into a subscription service (😠), you can only create 3 applets at a time. Make sure to archive applets you do not want to use.

3. Select Webhooks.
![Select webhooks on IFTTT](https://i.imgur.com/tDigD3K.png)

4. Click `Receive a web request`.

5. Enter `pman_del`.  
![Enter pman_del in the event name](https://i.imgur.com/qpDkY8y.png)  
**IT CANNOT BE ANYTHING ELSE!**  

6. Link the event to any service you want. For example, I'm using Notifications.  
![Send a notification to the IFTTT app](https://i.imgur.com/TC26KbN.png)

7. Press Continue and set up any other settings you like.  
![Press the button that says Continue](https://i.imgur.com/vEXh004.png)

8. Repeat steps 1-4. This time, enter `pman_issue`.

9. Once you have your applets ready, head over [here](https://ifttt.com/maker_webhooks/settings) and copy the end of the link.  
It'll look like this: `https://maker.ifttt.com/use/>>ioSngMw9NsMalWngkSmwSa<<`.  
You copy where it is marked.

10. Add it to your `.env` file. And you're done!

Any issues? Submit an issue below.

### Questions & Issues

Questions and issues can be sent over on my [issues page.](https://github.com/IceBotYT/password-manager/issues)

###### Thank you for using my password manager ♥
