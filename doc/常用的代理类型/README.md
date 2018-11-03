# 目录

<!-- prettier-ignore-start -->

<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

* [目录](#目录)
* [正文](#正文)
* [一个 http 请求发生了什么？](#一个-http-请求发生了什么)
* [DNS/域名解析](#dns域名解析)
	* [udp 方式，先回应的数据包被当做有效数据](#udp-方式先回应的数据包被当做有效数据)
	* [tcp 方式，有时有效，可能被 rest](#tcp-方式有时有效可能被-rest)
	* [黑名单/白名单](#黑名单白名单)
	* [本地 DNS 软件](#本地-dns-软件)
	* [路由器智能 DNS](#路由器智能-dns)
* [http proxy](#http-proxy)
	* [http proxy 请求和没有 proxy 的请求的区别](#http-proxy-请求和没有-proxy-的请求的区别)
	* [目标服务器能否感知到 http proxy 的存在？](#目标服务器能否感知到-http-proxy-的存在)
	* [http proxy keep-alive](#http-proxy-keep-alive)
	* [http proxy authentication](#http-proxy-authentication)
	* [http proxy 对于不认识的 header 和方法的处理方式](#http-proxy-对于不认识的-header-和方法的处理方式)
* [https proxy](#https-proxy)
	* [http tunnel](#http-tunnel)
	* [https proxy 的安全性？](#https-proxy-的安全性)
* [goagent 工作原理](#goagent-工作原理)
	* [为什么 goagent 可以看视频？](#为什么-goagent-可以看视频)
	* [goagent 缺点](#goagent-缺点)
* [vpn](#vpn)
	* [网页版的 SSL VPN](#网页版的-ssl-vpn)
	* [新型的 staless vpnVPN，sigmavpn/ShadowVPN](#新型的-staless-vpnvpnsigmavpnshadowvpn)
* [socks proxy](#socks-proxy)
	* [socks proxy 握手的过程](#socks-proxy-握手的过程)
	* [ssh socks proxy](#ssh-socks-proxy)
	* [shadowsocks 的工作原理](#shadowsocks-的工作原理)
	* [shadowsoks 的优点](#shadowsoks-的优点)
	* [shadowsocks 的安全性](#shadowsocks-的安全性)
	* [vpn 和 socks 代理的区别](#vpn-和-socks-代理的区别)
	* [linux 下一些软件配置代理的方法](#linux-下一些软件配置代理的方法)
	* [linux 下不支持代理的程序使用 socks 代理：tsocks](#linux-下不支持代理的程序使用-socks-代理tsocks)
* [基于路由器的方案](#基于路由器的方案)
* [推荐的办法](#推荐的办法)
* [各种加密代理协议的简单对比](#各种加密代理协议的简单对比)
	* [性能](#性能)
	* [数据安全性](#数据安全性)
	* [抗识别](#抗识别)
	* [部署难度](#部署难度)
	* [功能](#功能)

<!-- /code_chunk_output -->

<!-- prettier-ignore-end -->

# 正文

网络代理的工具很多，八仙过海，各显神通，而且综合了各种技术。
本文尝试从以下四个常用技术来解析一些原理。

1. dns.
1. http/https proxy.
1. vpn.
1. socks proxy.

# 一个 http 请求发生了什么？

这是个比较流行的面试题，从中可以引出很多的内容。大致分为下面四个步骤：

1. `dns` 解析，得到 `IP`
1. 向目标 `IP` 发起 `TCP` 请求
1. 发送 `http request`
1. 服务器回应 `http response`，浏览器解析

还有很多细节，更多参考：

http://fex.baidu.com/blog/2014/05/what-happen/

http://stackoverflow.com/questions/2092527/what-happens-when-you-type-in-a-url-in-browser

http://div.io/topic/609?page=1

# DNS/域名解析

dns 解析是最初的一步，也是最重要的一步。比如访问亲友，要知道他的正确的住址，才能正确地上门拜访。

dns 可以使用两种协议，一种是 UDP（默认），一种是 TCP。

## udp 方式，先回应的数据包被当做有效数据

在 linux 下可以用 dig 来检测 dns。国内的 DNS 服务器通常不会返回正常的结果。
下面以 google 的 8.8.8.8 dns 服务器来做测试，并用 wireshark 来抓包，分析结果。

```shell
dig @8.8.8.8 www.youtube.com
```

@import "dns-udp-youtube-badresponse-fast.png"

从 wireshark 的结果，可以看到返回了三个结果，**前面两个是错误的，后面的是正确的**。

但是，对于 dns 客户端来说，它只会取最快回应的的结果，导致后面的正确结果被丢弃掉了。而因为 dns 请求中间被插入了污染包，所以即使我们配置了正确的 dns 服务器，也解析不到正确的 IP。

## tcp 方式，有时有效，可能被 rest

再用 TCP 模式下的 DNS 来测试下:

```shell
dig @8.8.8.8 +tcp www.youtube.com
```

@import "dns-tcp-youtube-reset.png"

从 wireshark 的结果，可以看出在 TCP 三次握手成功后，本地发出了一个查询 www.youtube.com 的 dns 请求。

结果很快收到了一个 RST 回应。

而 RST 回应是在 TCP 连接断开时才会出现的，所以可以看出，**TCP 通讯受到了干扰，DNS 客户端因为收到 RST 回应，认为对方断开了连接，因此也无法收到后面正确的回应数据包了。**

再来看下解析 twitter 的结果：

```shell
dig @8.8.8.8 +tcp www.twitter.com
```

结果：

```shell
www.twitter.com. 590 IN CNAME twitter.com.
twitter.com. 20 IN A 199.59.150.7 80
twitter.com. 20 IN A 199.59.150.7
twitter.com. 20 IN A 199.59.149.230
twitter.com. 20 IN A 199.59.150.39
```

这次返回的 IP 是正确的。但是尝试用 telnet 去连接时，会发现连接不上。

```shell
telnet 199.59.150.7 80
```

但是，使用国外服务器去连接时，却可以正常连接，完成一个 http 请求。可见一些 IP 的访问被禁止了。

```shell
$ telnet 199.59.150.7 80
Trying 199.59.150.7...
Connected to 199.59.150.7.
Escape character is '^]'.
GET / HTTP/1.0
HOST:www.twitter.com

HTTP/1.0 301 Moved Permanently
content-length: 0
date: Sun, 08 Feb 2015 06:28:08 UTC
location: https://www.twitter.com/
server: tsa_a
set-cookie: guest_id=v1%3A142337688883648506; Domain=.twitter.com; Path=/; Expires=Tue, 07-Feb-2017 06:28:08 UTC
x-connection-hash: 0f5eab0ea2d6309109f15447e1da6b13
x-response-time: 2
```

## 黑名单/白名单

想要获取到正确的 IP，自然的会想到黑名单/白名单两种思路。

下面列出一些相关的项目：

1. https://github.com/holmium/dnsforwarder
1. https://code.google.com/p/huhamhire-hosts/
1. https://github.com/felixonmars/dnsmasq-china-list

## 本地 DNS 软件

1. 修改 hosts 文件
   相信大家都很熟悉，也有一些工具可以自动更新 hosts 文件的。
1. 浏览器 pac 文件
   主流浏览器或者其插件，都可以配置 pac 文件。pac 文件实际上是一个 JS 文件，可以通过编程的方式来控制 dns 解析结果。其效果类似 hosts 文件，不过 pac 文件通常都是由插件控制自动更新的。只能控制浏览器的 dns 解析。
1. 本地 dns 服务器，dnsmasq
   在 linux 下，可以自己配置一个 dnsmasq 服务器，然后自己管理 dns。不过比较高级，也比较麻烦。

## 路由器智能 DNS

基于 OpenWRT/Tomoto 的路由器可以在上面配置 dns server，从而实现在路由器级别智能 dns 解析。现在国内的一些路由器是基于 OpenWRT 的，因此支持配置 dns 服务器。
参考项目：https://github.com/clowwindy/ChinaDNS

# http proxy

## http proxy 请求和没有 proxy 的请求的区别

在 chrome 里没有设置 http proxy 的请求头信息是这样的：

```
GET /nocache/fesplg/s.gif
Host: www.baidu.com
```

在设置了 http proxy 之后，发送的请求头是这样的：

```
GET http://www.baidu.com//nocache/fesplg/s.gif
Host: www.baidu.com
Proxy-Connection: keep-alive
```

区别是配置 http proxy 之后，会在请求里发送完整的 url。

client 在发送请求时，如果没有 proxy，则直接发送 path，如果有 proxy，则要发送完整的 url。

实际上 http proxy server 可以处理两种情况，即使客户端没有发送完整的 url，因为 host 字段里，已经有 host 信息了。

为什么请求里要有完整的 url？ - 历史原因。

## 目标服务器能否感知到 http proxy 的存在？

当我们使用 http proxy 时，有个问题可能会关心的：目标服务器能否感知到 http proxy 的存在？

一个配置了 proxy 的浏览器请求头：

```
GET http://55.75.138.79:9999/ HTTP/1.1
Host: 55.75.138.79:9999
Proxy-Connection: keep-alive
```

实际上目标服务器接收到的信息是这样子的：

```
GET / HTTP/1.1
Host: 55.75.138.79:9999
Connection: keep-alive
```

可见，http proxy 服务器并没有把 proxy 相关信息发送到目标服务器上。

因此，目标服务器是没有办法知道用户是否使用了 http proxy。

## http proxy keep-alive

实际上 `Proxy-Connection: keep-alive` 这个请求头是错误的，不在标准里：

因为 http/1.1 默认就是 `Connection: keep-alive`

如果 client 想要 http proxy 在请求之后关闭 connection，可以用 Proxy-Connection: close 来指明。

http://homepage.ntlworld.com/jonathan.deboynepollard/FGA/web-proxy-connection-header.html

## http proxy authentication

当 http proxy 需要密码时：

第一次请求没有密码，则会回应

```
HTTP/1.1 407 Proxy authentication required
Proxy-Authenticate: Basic realm="Polipo"
```

浏览器会弹出窗口，要求输入密码。
如果密码错误的话，回应头是：

```
HTTP/1.1 407 Proxy authentication incorrect
```

如果是配置了密码，发送的请求头则是：

```
GET http://www.baidu.com/ HTTP/1.1
Host: www.baidu.com
Proxy-Connection: keep-alive
Proxy-Authorization: Basic YWRtaW46YWRtaW4=
```

Proxy-Authorization 实际是 Base64 编码。

```
base64("admin:admin") == "YWRtaW46YWRtaW4="
```

## http proxy 对于不认识的 header 和方法的处理方式

http proxy 通常会尽量原样发送，因为很多程序都扩展了 http method，如果不支持，很多程序都不能正常工作。

客户端用 OPTIONS 请求可以探测服务器支持的方法。但是意义不大。

# https proxy

当访问一个 https 网站时，https://github.com

先发送 connect method，如果支持，会返回 200

```
CONNECT github.com:443 HTTP/1.1
Host: github.com
Proxy-Connection: keep-alive
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36

HTTP/1.1 200 OK
```

## http tunnel

http://en.wikipedia.org/wiki/HTTP_tunnel#HTTP_CONNECT_tunneling

通过 connect method，http proxy server 实际上充当 tcp 转发的中间人。
比如，用 nc 通过 http proxy 来连 42 端口：

```shell
$ nc -x10.2.3.4:8080 -Xconnect host.example.com 42
```

原理是利用 CONNECT 方法，让 http proxy 服务器充当中间人。

## https proxy 的安全性？

proxy server 可以拿到什么信息？ 通过一个 https proxy 去访问支付宝是否安全？

1. 可以知道 host，即要访问的是哪个网站
1. 拿不到 url 信息
1. https 协议保证不会泄露通信内容
1. TLS(Transport Layer Security) 在握手时，生成强度足够的随机数
1. TLS 每一个 record 都要有一个 sequence number，每发一个增加一个，并且是不能翻转的。
1. TLS 保证不会出现重放攻击
1. TLS 的内容很多，这里说到关于安全的一些关键点。

注意事项：

1. 确保是 https 访问
1. 确保访问网站的证书没有问题
1. 是否真的安全了？更强的攻击者！流量劫持 —— 浮层登录框的隐患
   http://fex.baidu.com/blog/2014/06/danger-behind-popup-login-dialog/

所以，**尽量不要使用来路不明的 http/https proxy，使用公开的 wifi 也要小心**。

# goagent 工作原理

1. local http/https proxy
1. 伪造 https 证书，导入浏览器信任列表里
1. 浏览器配置 http/https proxy
1. 解析出 http/https request 的内容。然后把这些请求内容打包，发给 GAE 服务器
1. 与 GAE 通信通过 http/https，内容用 RC4 算法加密
1. GAE 服务器，再调用 google 提供的 urlfetch，来获得请求的回应，然后再把回应打包，返回给客户端。
1. 客户端把回应传给浏览器
1. 自带 dns 解析服务器
1. 在 local/certs/ 目录下可以找到缓存的伪造的证书

fiddler 抓取 https 数据包是同样原理。

goagent 会为每一个 https 网站伪造一个证书，并缓存起来。比如下面这个 github 的证书：

@import "goagent-github-cert.png"

goagent 的代码在 3.0 之后，支持了很多其它功能，变得有点混乱了。

以 3.2.0 版本为例：

主要的代码是在 server/gae/gae.py 里：
https://github.com/goagent/goagent/blob/v3.2.0/server/gae/gae.py#L107

一些代码实现的细节：

1. 支持最长的 url 是 2083，因为 gae sdk 的限制。
   https://github.com/AppScale/gae_sdk/blob/master/google/appengine/api/taskqueue/taskqueue.py#L241
1. 如果回应的内容是/text, json, javascript，且 > 512 会用 gzip 来压缩
1. 处理一些 Content-Range 的回应内容。Content-Range 的代码虽然只有一点点，但是如果是不熟悉的话，要花上不少工夫。
1. goagent 的生成证书的代码在 local/proxylib.py 的这个函数里：

```
@staticmethod
def \_get_cert(commonname, sans=()):
```

## 为什么 goagent 可以看视频？

因为很多网站都是 http 协议的。有少部分是 rmtp 协议的，也有是 rmtp over http 的。

在 youku 看视频的一个请求数据：

```
http://14.152.72.22/youku/65748B784A636820C5A81B41C7/030002090454919F64A167032DBBC7EE242548-46C9-EB9D-916D-D8BA8D5159D3.flv?&start=158
response：
Connection:close
Content-Length:7883513
Content-Type:video/x-flv
Date:Wed, 17 Dec 2014 17:55:24 GMT
ETag:"316284225"
Last-Modified:Wed, 17 Dec 2014 15:21:26 GMT
Server:YOUKU.GZ
```

可以看到，有 ETag，有长度信息等。

## goagent 缺点

1. 只是 http proxy，不能代理其它协议
1. google 的 IP 经常失效
1. 不支持 websocket 协议
1. 配置复杂

# vpn

流行的 vpn 类型：

1. PPTP，linux pptpd，安全性低，不能保证数据完整性或者来源，MPPE 加密暴力破解
1. L2TP，linux xl2tpd，预共享密钥可以保证安全性
1. SSTP，基于 HTTPS，微软提出。linux 开源实现 SoftEther VPN
1. OPENVPN，基于 SSL，预共享密钥可以保证安全性
1. 所谓的 SSL VPN，各家厂商有自己的实现，没有统一的标准
1. 新型的 staless VPN，像 sigmavpn/ShadowVPN 等

现状：

1. PPTP/L2TP 可用，但可能会不管用
1. SoftEther VPN/OPENVPN 可能会导致服务器被封 IP，连不上，慎用
1. ShadowVPN 可用，sigmavpn 没有测试

猜测下为什么 PPTP，L2TP 这些方案容易被检测到？

可能是因为它们的协议都有明显的标头：

1. 转发的是 ppp 协议数据，握手有特征
1. PPTP 协议有 GRE 标头和 PPP 标头
1. L2TP 有 L2TP 标头和 PPP 标头
1. L2TP 要用到 IPsec

参考：

https://technet.microsoft.com/zh-cn/library/cc771298(v=ws.10).aspx

## 网页版的 SSL VPN

有些企业，或者学校里，会有这种 VPN：

1. 网页登陆帐号
1. 设置 IE 代理，为远程服务器地址
1. 通过代理浏览内部网页
   这种 SSL VPN 原理很简单，就是一个登陆验证的 http proxy，其实并不能算是 VPN？

## 新型的 staless vpnVPN，sigmavpn/ShadowVPN

这种新型 VPN 的原理是，利用虚拟的网络设备 TUN 和 TAP，把请求数据先发给虚拟设备，然后把数据加密转发到远程服务器。（VPN 都这原理？）

```
you <-> local <-> protocol <-> remote <-> ...... <-> remote <-> protocol <-> local <-> peer
```

这种新型 VPN 的特点是很轻量，没有传统 VPN 那么复杂的握手加密控制等，而向个人，而非企业。SigmaVPN 号称只有几百行代码。

参考：

http://zh.wikipedia.org/wiki/TUN%E4%B8%8ETAP

https://code.google.com/p/sigmavpn/wiki/Introduction

# socks proxy

1. rfc 文档： http://tools.ietf.org/html/rfc1928
1. wiki 上的简介： http://en.wikipedia.org/wiki/SOCKS#SOCKS5
1. socks4/socks4a 已经过时
1. socks5
   socks5 支持 udp，所以如果客户端把 dns 查询也走 socks 的话，那么就可以直接解决 dns 的问题了。

## socks proxy 握手的过程

socks5 流程

1. 客户端查询服务器支持的认证方式
1. 服务器回应支持的认证方式
1. 客户端发送认证信息，服务器回应
1. 如果通过，客户端直接发送 TCP/UDP 的原始数据，以后 proxy 只单纯转发数据流，不做任何处理了
1. socks proxy 自身没有加密机制，简单的 TCP/UDP forward

socks 协议其实是相当简单的，用 wireshark 抓包，结合 netty-codec-socks，很容易可以理解其工作过程。
https://github.com/netty/netty/tree/master/codec-socks

## ssh socks proxy

如果有一个外国的服务器，可以通过 ssh 连接登陆，那么可以很简单地搭建一个本地的 socks5 代理。

linux 下命令行启动一个本地 sock5 服务器：

```shell
ssh -D 1080 user@romoteHost
```

ssh 还有一些端口转发的技巧，这对于测试网络程序，绕过防火墙也是很有帮助的。

参考：http://www.ibm.com/developerworks/cn/linux/l-cn-sshforward/

## shadowsocks 的工作原理

shadowsocks 是非常流行的一个代理工具，其原理非常简单。

1. 客户端服务器预共享密码
1. 本地 socks5 proxy server（有没有想起在学校时用的 ccproxy？）
1. 软件/浏览器配置本地 socks 代理
1. 本地 socks server 把数据包装，AES256 加密，发送到远程服务器
1. 远程服务器解密，转发给对应的服务器

```
app => local socks server(encrypt) => shadowsocks server(decrypt) => real host

app <= (decrypt) local socks server <= (encrypt) shadowsocks server <= real host
```

其它的一些东东：

1. 一个端口一个密码，没有用户的概念
1. 支持多个 worker 并发
1. 协议简单，比 socks 协议还要简单，抽取了 socks 协议的部分

## shadowsoks 的优点

1. 中间没有任何握手的环节，直接是 TCP 数据流
1. 速度快

## shadowsocks 的安全性

1. 服务器可以解出所有的 TCP/UDP 数据
1. 中间人攻击，重放攻击

所以，对于第三方 shadow socks 服务器，要慎重使用。

在使用 shadowsocks 的情况下，https 通迅是安全的，但是仍然有危险，参见上面 http proxy 安全的内容。

## vpn 和 socks 代理的区别

从原理上来说，socks 代理会更快，因为转发的数据更少。

因为 vpn 转发的是 ppp 数据包，ppp 协议是数据链路层(data link layer)的协议。socks 转发的是 TCP/UDP 数据，是传输(transport)层。

VPN 的优点是很容易配置成全局的，这对于很多不能配置代理的程序来说很方便。而配置全局的 socks proxy 比较麻烦，目前貌似还没有简单的方案。

## linux 下一些软件配置代理的方法

- bash/shell
  对于 shell，最简单的办法是在命令的前面设置下 http_porxy 的环境变量。

```shell
http_proxy=http://127.0.0.1:8123 wget http://test.com
```

推荐的做法是在~/.bashrc 文件里设置两个命令，开关 http proxy：

```shell
alias proxyOn='export https_proxy=http://127.0.0.1:8123 && http_proxy=http://127.0.0.1:8123'
alias proxyOff='unset https_proxy && unset http_proxy'
```

注意，如果想 sudo 的情况下，http proxy 仍然有效，要配置 env_keep。

在/etc/sudoers.d/目录下增加一个 env_keep 的文件，内容是：

```shell
Defaults env_keep += " http_proxy https_proxy ftp_proxy "
```

参考：
https://help.ubuntu.com/community/AptGet/Howto#Setting_up_apt-get_to_use_a_http-proxy

- GUI 软件
  现在大部分软件都可以设置代理。
  gnome 和 kde 都可以设置全局的代理。

## linux 下不支持代理的程序使用 socks 代理：tsocks

tsocks 利用 LD_PRELOAD 机制，代理程序里的 connect 函数，然后就可以代理所有的 TCP 请求了。
不过 dns 请求，默认是通过 udp 来发送的，所以 tsocks 不能代理 dns 请求。

默认情况下，tsocks 会先加载~/.tsocks.conf，如果没有，再加载/etc/tsocks.conf。对于 local ip 不会代理。

使用方法：

```shell
sudo apt-get install tsocks
LD_PRELOAD=/usr/lib/libtsocks.so wget http://www.facebook.com
```

# 基于路由器的方案

基于路由器的方案有很多，原理和本机的方案是一样的，只不过把这些措施前移到路由器里。

路由器的方案的优点是很明显的：

1. 手机/平板不用设置
1. 公司/局域网级的代理

但是需要专门的路由器，刷固件等。

shadowsocks, shadowvpn 都可以跑在路由器上。

一些项目收集：

https://github.com/lifetyper/FreeRouter_V2

https://gist.github.com/wen-long/8644243

https://github.com/ashi009/bestroutetb

# 推荐的办法

完全免费

1. chrome + switchsharp/SwitchyOmega + http proxy
1. goagent

程序员的推荐

1. chrome + switchsharp/SwitchyOmega + socks5 proxy
1. aws 免费一年的服务器/其它国外免费云主机，节点位置决定速度，推荐东京机房
1. shadowsocks

手机软件：

1. fqrouter
1. shadowsocks client

商业软件安全性自己考虑

# 各种加密代理协议的简单对比

目前我们常用的加密代理有协议有 HTTPS，SOCKS5-TLS 和 shadowsocks,此文从各个角度简单分析各个协议的优劣，以帮助各位选择合适的协议。

先简单说些背景知识，以上协议都是基于 TCP 的代理协议，代理协议（Proxy Procotol）与 VPN 不同，仅可被用于通过代理服务器转发 TCP 连接（shadowsocks 支持代理 UDP），而 VPN 可被用于 IP 层上的所有协议，如 TCP、UDP、ICMP 等。所以在使用代理时，ping 等 ICMP 应用是不可以被代理的。

然后简单解释一下什么是 TLS，TLS 又名 SSL，是针对数据流的安全传输协议。简单来说，一个 TCP 链接，把其中原本要传输的数据，按照 TLS 协议去进行加密传输，那么即可保证其中传输的数据安全。这个安全至少体现在以下几个方面：

1. 数据被加密，任何可以截取到 TCP 数据流的人，无法解密出原始数据；
1. 数据不可被篡改，一旦篡改会导致解密失败，连接断开；
1. 服务器身份验证，基于 X509 的证书体系去确认目标服务器是否为真实的服务器。

明文的 HTTP 套上一层 TLS，也就变成了 HTTPS，SOCKS5 套上 TLS，就变成了 SOCKS5-TLS。TLS 协议是整个互联网安全的基石，几乎所有需要安全传输的地方都使用了 TLS，如银行、政府等等。

当被用作代理协议时，HTTP 层和 SOCKS5 层去进行具体的代理连接控制，如进行身份验证、告知需要转发的目标主机名等。所以不需要 TLS 他们也可以用作代理，只不过所有数据都是明文传输，不具备安全性。加上 TLS 后，由 TLS 去保证安全。而 shadowsocks 协议则融合了代理控制和安全保证。所以后文的很多对比实际上是 shadowsocks 和 TLS 的对比。

## 性能

TLS 协议由于承担了一项额外的功能，需要验证目标服务器身份，导致其握手时会比较复杂。

**ping 的时间表示，一个 IP 层数据包从本地发出，到服务器再返回的来回时间，即 RTT（round-trip time）。**

在发起代理连接时，首先我们需要进行 TCP 3 次握手，耗时为 1 个 RTT。（此处把最后的 ACK 直接并入后续的数据传输部分）。

然后进行 TLS 握手，因为服务端和客户端需要进行身份验证并协商协议版本号、加密方式等细节，第一次连接时需要 2 个 RTT。当然 TLS 的制定者也发现这太慢了，于是引入了 TLS Session Resumption，当服务端和客户端服务器连接过一次后，之后的连接可以直接复用先前的协商结果，使得 RTT 降低到 1 个 RTT。但这需要服务器和客户端的支持。（这是为什么 Surge benchmark 时，对于 TLS 代理第一次的测试结果可能较慢的原因之一）

对于 HTTPS 协议，当 TLS 连接建立后，客户端通过 HTTP 层发起代理请求，服务端回应连接建立，此后进入正常的代理通讯环节，再耗费 1 个 RTT。

对于 SOCKS5-TLS 协议，当 TLS 连接建立后，如果没有验证的环节，那么需要再耗费 1 个 RTT，如果有验证（用户名密码），那么需要耗费 2 个 RTT。

而对于 shadowsocks，由于使用的是预共享密钥（pre-shared key, PSK），加密方式也是预先约定好的，所以不需要进行协商，只需要在 TCP 建立之后，再耗费一个 1 个 RTT 告知目标主机名。

总结如下：

HTTPS（TLS Session Resumption）：3 个 RTT

SOCKS5-TLS 无验证：3 个 RTT

SOCKS5-TLS 有验证：4 个 RTT

shadowsocks：2 个 RTT

（注：最后一个 RTT 并不严谨，因为客户端可以在最后一个 RTT 产生响应前，直接开始后续传输。另外如果使用了 TCP Fast Open，可以看作 TCP 阶段 RTT 为 0。）

对于日常使用，最影响性能的就是握手速度，后续传输过程中的加解密性能，对于现代 CPU 来说基本都不会构成瓶颈。 shadowsocks 由于有 PSK 的特点，在 TCP 协议基础上已经达到极限，不可能有协议能再低于 2 个 RTT。

所以，同等网络环境下，shadowsocks 是明显快于 HTTPS 的。（体现在延迟上，而不是带宽）

另外，最新的 TLS 1.3 协议正力图解决这个问题，由于目前还处于草案阶段，各种工具链不完善，现在不太好评估实际效果。

## 数据安全性

（此处说的数据安全性，指的是加密后的流量是否会被截取并破解的问题。）

对于 TLS，作为个人用户，丝毫不用担心，TLS 协议如果真的不安全了，世界早就乱套了…

对于 shadowsocks，使用的加密方法也都是工业上成熟的算法，从数据安全性角度考虑也基本不用担心。

## 抗识别

这个问题有两个角度需要考虑：

1. 观察一段数据流量，是否能判别这是一个代理协议的流量；
1. 对于一个仅暴露出 TCP 端口的黑箱，能否判断这个端口提供了代理服务。

对于 shadowsocks 协议，在第一点上，观察者只能判定这个数据流为未知的协议。而第二点，shadowsocks 的几次修改，都是因为在这出了问题，目前最新的 AEAD 加密方式，应该已经解决了这个问题，但还需要时间去检验。

对于 HTTPS 协议，在第一点上，观察者是无法去区分这是一个代理还是一个标准的 HTTPS 网页访问的（当访问 HTTP 页面时，如果访问 HTTPS 会使得流量模型出现特征）。而第二点，在妥善配置的情况下，也是完全无法判别。

但在实践中，大部分 HTTPS 代理服务器为了兼容浏览器行为，在直接被当做 HTTPS Web 服务器访问时，会返回代理错误页或者 407 Proxy authentication required，直接暴露了自己是一个代理，如果要抗击第二点，可以将服务端的行为修改为，如果请求的 Header 中，不包含一个有效的 Auth，那么就返回一个标准的 200 页面，这样从理论上杜绝了被嗅探的可能。

总结一下，最新的 shadowsocks 已经能满足抗识别的两个要求，但是观察者得到结论是“未知协议”。而使用 HTTPS，观察者无法判断这是一个 HTTPS 代理还是 HTTPS Web 服务器，这是更优的结果。

> 大隐隐于市

## 部署难度

HTTPS 协议使用广泛，有众多成熟的工业级工具，如 squid，haproxy，nghttp2 等等，但是由于 HTTPS 协议本身比较复杂，配置起来参数众多，有很多性能相关参数需要自己调优，所以一般用户配置起来会有难度。

shadowsocks 经过多年发展，目前也已经有众多的软件支持，但是对于不同特性的支持度不一。由于参数简单，部署配置起来极其方便。

## 功能

shadowsocks 目前还存在一些功能上的缺陷：

1. shadowsocks 没有设计错误回报机制，对于以下错误，客户端看到的行为都是服务器主动断开 TCP 连接, 这使得客户端没办法根据不同的错误采取进一步的动作，只能简单的向用户返回 Socket closed by remote 错误。

   1. 密钥或者加密方法错误
   1. 目标主机名 DNS 解析失败
   1. 目标主机不可达
   1. 目标主机拒绝连接

1. shadowsocks 没有考虑用户鉴别，使得服务端 ACL 或者流量统计等功能无法实现，主流的 workaround 是通过不同的端口号去识别不同的用户，但这极其浪费资源且很不优雅。

1. 部分 ISP 对于非 HTTP 和 TLS 的未知流量，会进行降速限制，这个可以通过配置 obfs 解决。
