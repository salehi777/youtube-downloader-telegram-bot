Written in NodeJS for getting youtube videos, locally or using telegram bot.

Audio and Video downloaded seperately then merged using ffmpeg. Also there is a function for re-encoding videos using ffmpeg because some of videos that uploaded to telegram displaying incorrecly (doesn't show time or miss thumbnail)

## 📝 Scripts

```bash
yarn dev-tel # development mode for telegram-bot
yarn dev-loc # development mode for locally

yarn build # build both telegram-bot and locally into /dist
yarn start-tel # production mode for telegram-bot
yarn start-loc # production mode for locally

yarn ts # check types without building
```

## 🤖 Telegram Bot Usage

### Telegram Bot Examples

```
User: <youtube-link>
Bot: get info, show qualities, download, upload

// skip getting info (info.json should exists from before)
User: skipinfo <youtube-link>
Bot: show qualities, download, upload

// re-encode currently existing video
User: reencode <youtube-link>
Bot: show qualities, re-encode , upload

// upload currently existing video
User: uploadonly <youtube-link>
Bot: show qualities, upload
```

## 🌉 Proxy

- Configure proxychains4 (https://github.com/shadowsocks/shadowsocks/wiki/Using-Shadowsocks-with-Command-Line-Tools)

  `~/.proxychains/proxychains.conf :`

  ```
  strict_chain
  proxy_dns
  remote_dns_subnet 224
  tcp_read_time_out 15000
  tcp_connect_time_out 8000
  localnet 127.0.0.0/255.0.0.0
  quiet_mode

  [ProxyList]
  socks5  127.0.0.1 1080
  ```

- Run throne or shadowsocks-electron

- ```
  proxychains4 yarn dev-tel
  ```

## 📝 To-Do

- [ ] Add thumbnail
- [ ] Show some video info before user selects quality
- [ ] Add slash commands
- [ ] Add Menu
- [ ] Search about other features