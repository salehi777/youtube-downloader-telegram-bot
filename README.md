# Proxy

Before running, terminal should be proxied

## Option 1

Run Nekoray, shadowsocks-electron or something that gives proxy in 127.0.0.1 and some port

```bash
curl --socks5 http://127.0.0.1 ifconfig.co
```

#### First method:

Configure proxychains4 (https://github.com/shadowsocks/shadowsocks/wiki/Using-Shadowsocks-with-Command-Line-Tools)

```bash
proxychains4 yarn start
```

#### Second method (Needs to add code from link below):

```bash
gost -L http://:8080 -F socks5://127.0.0.1:1080
```

In another terminal:

```bash
yarn start
```

- https://github.com/distubejs/ytdl-core?tab=readme-ov-file#proxy-support

- proxy is 'http://127.0.0.1:8080'

## Option2

This method not working, it supposed to work without using shadowsocks-electron (that gets a shadowsocks and gives socks5://127.0.0.1:1080)

Also needs to add code from link below.

```bash
gost -L http://:8080 -F ss://shadowsocks_proxy
```

- https://github.com/distubejs/ytdl-core?tab=readme-ov-file#proxy-support

- proxy is 'http://127.0.0.1:8080'

# Re-Encode

Some videos after uploading on telegram don't show time or thumbnail and don't have forward/backward with double tab. To fix this you can re-encode them using one of these commands (output file size will be bigger and it take CPU/RAM to run)

```bash
ffmpeg -i input.mp4 -c:v libx264 -c:a aac -movflags +faststart output.mp4

ffmpeg -i input.mp4 -c:v libx264 -crf 23 -maxrate 4.5M -preset faster -flags +global_header -pix_fmt yuv420p -profile:v baseline -movflags +faststart -c:a aac -ac 2 output.mp4

ffmpeg -i input.mp4 -c:v libx264 -g 30 -c:a copy -movflags +faststart output.mp4
```

to
re encode
show each quality size

## 📝 To-Do

- [ ] Add Re-Encode
- [ ] Show each quality size
- [ ] Show 4 steps progress in one message
