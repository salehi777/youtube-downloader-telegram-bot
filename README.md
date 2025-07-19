before running, terminal should be proxied

# Option 1

Run shadowsocks-electron or something that give you socks5://127.0.0.1:1080

Check if it's work: (or use telegram or nekoray)

```bash
curl --socks5 http://127.0.0.1 https://ifconfig.co/
```

## Running code

### First method:

Configure proxychains4 (https://github.com/shadowsocks/shadowsocks/wiki/Using-Shadowsocks-with-Command-Line-Tools)

```bash
proxychains4 yarn start
```

### Second method (Needs to add code from link below):

```bash
gost -L http://:8080 -F socks5://127.0.0.1:1080
```

In another terminal:

```bash
yarn start
```

- https://github.com/distubejs/ytdl-core?tab=readme-ov-file#proxy-support

- proxy is 'http://127.0.0.1:8080'

# Option2

This method not working, it supposed to work without using shadowsocks-electron (that gets a shadowsocks and gives socks5://127.0.0.1:1080)

Also needs to add code from link below.

```bash
gost -L http://:8080 -F ss://shadowsocks_proxy
```

- https://github.com/distubejs/ytdl-core?tab=readme-ov-file#proxy-support

- proxy is 'http://127.0.0.1:8080'
